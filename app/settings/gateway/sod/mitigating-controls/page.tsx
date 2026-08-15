"use client";

import React, { useEffect, useMemo, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import SodTabs from "@/components/SodTabs";
import dynamic from "next/dynamic";
import type { ColDef } from "ag-grid-enterprise";
import "@/lib/ag-grid-setup";
import { useRouter } from "next/navigation";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

const SOD_MITIGATING_CONTROL_VIEW_STORAGE_KEY = "sodMitigatingControlViewDraft";
const SOD_MITIGATING_CONTROL_EDIT_STORAGE_KEY = "sodMitigatingControlEditDraft";

type MitigatingControlJson = {
  "Control ID"?: string;
  Name?: string;
  Description?: string;
  "Control Type"?: string;
  "Control Method"?: string;
  "Applicable Policy ID"?: string;
  "Control owner"?: string;
  Actions?: string;
};

type MitigatingControlRow = {
  id: string;
  name: string;
  description: string;
  type: string;
  method: string;
  applicablePolicyId: string;
  owner: string;
};

export default function SodMitigatingControlsPage() {
  const router = useRouter();
  const [rowData, setRowData] = useState<MitigatingControlRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadMitigatingControls = async () => {
      try {
        const response = await fetch("/MitigatingControl.json");
        if (!response.ok) {
          throw new Error(`Failed to load MitigatingControl.json: ${response.status}`);
        }

        const json = (await response.json()) as MitigatingControlJson[];
        if (cancelled) return;

        const mappedRows = json.map((item) => ({
          id: (item["Control ID"] ?? "").trim(),
          name: (item.Name ?? "").trim(),
          description: (item.Description ?? "").trim(),
          type: (item["Control Type"] ?? "").trim(),
          method: (item["Control Method"] ?? "").trim(),
          applicablePolicyId: (item["Applicable Policy ID"] ?? "").trim(),
          owner: (item["Control owner"] ?? "").trim(),
        }));

        setRowData(mappedRows);
      } catch (error) {
        console.error("Error loading mitigating controls:", error);
        if (!cancelled) setRowData([]);
      }
    };

    loadMitigatingControls();

    return () => {
      cancelled = true;
    };
  }, []);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "ID",
        field: "id",
        minWidth: 90,
        maxWidth: 110,
        flex: 0.6,
      },
      {
        headerName: "Name",
        field: "name",
        minWidth: 150,
        flex: 1.2,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Description",
        field: "description",
        minWidth: 220,
        flex: 2.2,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Type",
        field: "type",
        minWidth: 80,
        maxWidth: 95,
        flex: 0.55,
      },
      {
        headerName: "Method",
        field: "method",
        minWidth: 92,
        maxWidth: 110,
        flex: 0.65,
      },
      {
        headerName: "Applicable Policy Id",
        field: "applicablePolicyId",
        minWidth: 160,
        flex: 1.3,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Owner",
        field: "owner",
        minWidth: 120,
        maxWidth: 145,
        flex: 0.75,
      },
      {
        headerName: "Action",
        field: "action",
        minWidth: 90,
        maxWidth: 110,
        flex: 0.7,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: { data?: MitigatingControlRow }) => (
          <div className="h-full w-full flex items-center justify-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
              aria-label="View mitigating control"
              title="View"
              onClick={() => {
                if (!params.data) return;
                try {
                  localStorage.setItem(
                    SOD_MITIGATING_CONTROL_VIEW_STORAGE_KEY,
                    JSON.stringify(params.data)
                  );
                } catch (error) {
                  console.error("Unable to save mitigating control draft:", error);
                }
                router.push("/settings/gateway/sod/mitigating-controls/review");
              }}
            >
              <Eye className="w-6 h-6" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
              aria-label="Edit mitigating control"
              title="Edit"
              onClick={() => {
                if (!params.data) return;
                try {
                  localStorage.setItem(
                    SOD_MITIGATING_CONTROL_EDIT_STORAGE_KEY,
                    JSON.stringify(params.data)
                  );
                } catch (error) {
                  console.error("Unable to save mitigating control edit draft:", error);
                }
                router.push("/settings/gateway/sod/mitigating-controls/new?mode=edit");
              }}
            >
              <Pencil className="w-6 h-6" />
            </button>
          </div>
        ),
      },
    ],
    [router]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: false,
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
            <h2 className="text-sm font-semibold text-gray-900">Mitigating Controls</h2>
            <Link
              href="/settings/gateway/sod/mitigating-controls/new"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New</span>
            </Link>
          </div>

          <div className="flex-1 min-h-0">
            <div className="ag-theme-alpine w-full">
              <AgGridReact
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                theme={themeQuartz}
                rowSelection="multiple"
                rowModelType="clientSide"
                animateRows={true}
                domLayout="autoHeight"
                suppressHorizontalScroll={true}
                onGridReady={(params) => {
                  params.api.sizeColumnsToFit();
                }}
                onGridSizeChanged={(params) => {
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

