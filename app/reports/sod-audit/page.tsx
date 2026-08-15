"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AgGridReactProps } from "ag-grid-react";
import { Eye } from "lucide-react";
import ClientOnlyAgGrid from "@/components/ClientOnlyAgGrid";
import sodViolations from "@/public/SodVoilations.json";

export default function SodAuditPage() {
  const router = useRouter();

  const columnDefs = useMemo<AgGridReactProps["columnDefs"]>(
    () => [
      { headerName: "ID", field: "Violation_ID", sortable: true, width: 90 },
      { headerName: "Identity", field: "Identity", sortable: true, width: 140 },
      { headerName: "Department", field: "Department", sortable: true, width: 130 },
      {
        headerName: "SOD Policy Name",
        field: "SOD_Policy_Name",
        sortable: true,
        flex: 4,
        minWidth: 320,
      },
      { headerName: "Risk", field: "Risk_Level", sortable: true, width: 110 },
      { headerName: "Detection Date", field: "Detection Date", sortable: true, width: 130 },
      {
        headerName: "Status",
        field: "Status",
        sortable: true,
        width: 120,
        valueGetter: () => "Open",
      },
      {
        headerName: "Action",
        field: "Action",
        sortable: false,
        filter: false,
        width: 100,
        cellRenderer: (params: any) => {
          const id = params?.data?.Violation_ID;
          const disabled = !id;
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!id) return;
                router.push(`/reports/sod-audit/${encodeURIComponent(id)}`);
              }}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-1 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
          );
        },
      },
    ],
    [router]
  );

  const defaultColDef = useMemo<AgGridReactProps["defaultColDef"]>(
    () => ({
      resizable: true,
      sortable: true,
    }),
    []
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-8 px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            SoD Dashboard
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            Analyze and remediate Segregation of Duties (SoD) violations across all your
            applications.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center flex flex-col items-center justify-center">
              <div className="mt-1 text-2xl font-semibold text-blue-800">
                23 <span className="text-sm font-medium uppercase tracking-wide text-blue-700">Users</span>
              </div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center flex flex-col items-center justify-center">
              <div className="mt-1 text-2xl font-semibold text-red-800">
                {Array.isArray(sodViolations) ? sodViolations.length : 0}{" "}
                <span className="text-sm font-medium uppercase tracking-wide text-red-700">Violations</span>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center flex flex-col items-center justify-center">
              <div className="mt-1 text-2xl font-semibold text-emerald-800">
                5 <span className="text-sm font-medium uppercase tracking-wide text-emerald-700">Apps</span>
              </div>
            </div>
          </div>
          <div className="mt-8 ag-theme-alpine w-full">
            <ClientOnlyAgGrid
              rowData={Array.isArray(sodViolations) ? sodViolations : []}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              autoSizeStrategy={{ type: "fitGridWidth" }}
              domLayout="autoHeight"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

