"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import SodTabs from "@/components/SodTabs";
import dynamic from "next/dynamic";
import type { ColDef } from "ag-grid-enterprise";
import "@/lib/ag-grid-setup";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

export default function SodSummaryPage() {
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        minWidth: 220,
        flex: 1,
      },
      {
        headerName: "Description",
        field: "description",
        minWidth: 260,
        flex: 2,
      },
      {
        headerName: "Owner",
        field: "owner",
        minWidth: 180,
      },
      {
        headerName: "Created On",
        field: "createdOn",
        minWidth: 160,
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    []
  );

  return (
    <div className="h-[calc(100vh-60px)] w-full">
      <div className="h-full w-full flex flex-col space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SoD</h1>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col">
          <SodTabs />

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
            <Link
              href="/settings/gateway/sod/summary/new"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New</span>
            </Link>
          </div>

          <div className="flex-1 min-h-0">
            <div className="h-full w-full">
              <AgGridReact
                rowData={[]}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowSelection="multiple"
                rowModelType="clientSide"
                animateRows={true}
                onGridReady={(params) => {
                  params.api.sizeColumnsToFit();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

