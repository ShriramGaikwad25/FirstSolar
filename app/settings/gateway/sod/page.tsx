"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { themeQuartz } from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Plus, Pencil, Eye } from "lucide-react";
import SodTabs from "@/components/SodTabs";
import dynamic from "next/dynamic";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-enterprise";
import "@/lib/ag-grid-setup";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

const SOD_BP_EDIT_STORAGE_KEY = "sodBusinessProcessEditDraft";
const SOD_BP_VIEW_STORAGE_KEY = "sodBusinessProcessViewDraft";

type BusinessProcessRow = {
  bpId: string;
  businessProcessName: string;
  description: string;
  owner: string;
  dateCreated: string;
  tags?: string;
};

const BusinessProcessTab: React.FC = () => {
  const router = useRouter();
  const { isVisible, sidebarWidthPx } = useLeftSidebar();
  const gridApiRef = useRef<GridApi<BusinessProcessRow> | null>(null);

  const rowData = useMemo(
    (): BusinessProcessRow[] => [
      {
        bpId: "BP1",
        businessProcessName: "Procure to Pay",
        description:
          "Manages supplier setup, invoice handling, and payment release activities.",
        owner: "SysAdm",
        dateCreated: "01/08/2026",
      },
      {
        bpId: "BP2",
        businessProcessName: "Revenue and Credit Management",
        description:
          "Manages customer order, revenue handling, and credit decision activities.",
        owner: "SysAdm",
        dateCreated: "01/22/2026",
      },
      {
        bpId: "BP3",
        businessProcessName: "Directory Access Administration",
        description:
          "Manages operational directory access, support access, and administrative control.",
        owner: "SysAdm",
        dateCreated: "02/03/2026",
      },
      {
        bpId: "BP4",
        businessProcessName: "Identity Governance and Access App",
        description:
          "Manages access assignment, approvals, and oversight across enterprise systems.",
        owner: "SysAdm",
        dateCreated: "02/17/2026",
      },
      {
        bpId: "BP5",
        businessProcessName: "HR Lifecycle Management",
        description:
          "Manages recruiting, worker maintenance, payroll, and employee status changes.",
        owner: "SysAdm",
        dateCreated: "03/01/2026",
      },
      {
        bpId: "BP6",
        businessProcessName: "HCM Platform Operations",
        description:
          "Manages HCM platform administration, integrations, data movement, and audit functions.",
        owner: "SysAdm",
        dateCreated: "03/10/2026",
      },
    ],
    []
  );

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "BP_ID",
        field: "bpId",
        minWidth: 120,
        width: 120,
      },
      {
        headerName: "Business_Process_Name",
        field: "businessProcessName",
        minWidth: 280,
        width: 280,
      },
      {
        headerName: "Description",
        field: "description",
        minWidth: 460,
        flex: 3,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Owner",
        field: "owner",
        minWidth: 130,
        width: 130,
      },
      {
        headerName: "Date Created",
        field: "dateCreated",
        minWidth: 165,
        width: 165,
        suppressSizeToFit: true,
      },
      {
        headerName: "Actions",
        field: "actions",
        minWidth: 150,
        width: 150,
        cellRenderer: (params: { data?: BusinessProcessRow }) => (
          <div className="h-full w-full flex items-center justify-center gap-4">
            <button
              type="button"
              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
              aria-label="View business process"
              title="View"
              onClick={() => {
                if (!params.data) return;
                try {
                  localStorage.setItem(
                    SOD_BP_VIEW_STORAGE_KEY,
                    JSON.stringify({
                      bpId: params.data.bpId,
                      name: params.data.businessProcessName,
                      owner: params.data.owner,
                      tags: params.data.tags ?? "",
                      description: params.data.description,
                      dateCreated: params.data.dateCreated,
                    })
                  );
                } catch (error) {
                  console.error("Unable to save view draft:", error);
                }
                router.push("/settings/gateway/sod/business-process/review");
              }}
            >
              <Eye className="w-6 h-6" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
              aria-label="Edit business process"
              title="Edit"
              onClick={() => {
                if (!params.data) return;
                try {
                  localStorage.setItem(
                    SOD_BP_EDIT_STORAGE_KEY,
                    JSON.stringify({
                      bpId: params.data.bpId,
                      name: params.data.businessProcessName,
                      owner: params.data.owner,
                      tags: params.data.tags ?? "",
                      description: params.data.description,
                      dateCreated: params.data.dateCreated,
                    })
                  );
                } catch (error) {
                  console.error("Unable to save edit draft:", error);
                }
                router.push("/settings/gateway/sod/business-process/new?mode=edit");
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
      filter: true,
      resizable: true,
    }),
    []
  );

  const fitColumns = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.sizeColumnsToFit();
  }, []);

  const handleGridReady = useCallback(
    (params: GridReadyEvent<BusinessProcessRow>) => {
      gridApiRef.current = params.api;
      fitColumns();
    },
    [fitColumns]
  );

  useEffect(() => {
    if (!gridApiRef.current) return;
    const timer = window.setTimeout(() => {
      fitColumns();
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fitColumns, isVisible, sidebarWidthPx]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Business Processes</h2>
        <Link
          href="/settings/gateway/sod/business-process/new"
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New</span>
        </Link>
      </div>

      <div className="flex-1 min-h-0">
        <div className="ag-theme-alpine h-full w-full">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            theme={themeQuartz}
            rowSelection="multiple"
            rowModelType="clientSide"
            animateRows={true}
            onGridReady={handleGridReady}
            onGridSizeChanged={fitColumns}
            onFirstDataRendered={fitColumns}
          />
        </div>
      </div>
    </div>
  );
};

export default function GatewaySoDSettings() {
  return (
    <div className="h-[calc(100vh-60px)] w-full ">
      <div className="h-full w-full flex flex-col space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SoD</h1>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col">
          <SodTabs />
          <BusinessProcessTab />
        </div>
      </div>
    </div>
  );
}

