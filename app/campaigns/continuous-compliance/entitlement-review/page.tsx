"use client";

import React, { useMemo } from "react";
import { themeQuartz } from "ag-grid-community";
import dynamic from "next/dynamic";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { useSearchParams } from "next/navigation";
import "@/lib/ag-grid-setup";
import Filters from "@/components/agTable/Filters";
import ActionButtons from "@/components/agTable/ActionButtons";
import { Lightbulb } from "lucide-react";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

const defaultRows = [
  {
    id: "1",
    entitlement: "ZNEW_FI_BUDGET_PLANNING",
    entitlementDescription:
      "Manages HR transactions and worker data maintenance. Ensures accuracy, approvals, and privacy safeguards under governed workflows.",
    entitlementType: "Group",
    account: "svc_budget_01",
    applicationName: "SAP_S4",
    lastLogin: "03/21/25",
  },
  {
    id: "2",
    entitlement: "/OTX/RM_ADMIN",
    entitlementDescription:
      "Handles directory group membership for routing access. Ensures SSO mapping and least-privilege enablement under governed workflows.",
    entitlementType: "Group",
    account: "svc_otx_admin",
    applicationName: "SAP_S4",
    lastLogin: "03/21/25",
  },
];

const OWNER_INACTIVE_DESCRIPTION =
  "Entitlement ownership requires review because the designated owner is inactive. Reassign or certify the entitlement to restore governed ownership.";

export default function ContinuousComplianceEntitlementReviewPage() {
  const searchParams = useSearchParams();
  const reviewerId = searchParams.get("reviewerId") || "DUMMY_REVIEWER";
  const certId = searchParams.get("certificationId") || "DUMMY_CERT";
  const singleEntitlement = searchParams.get("singleEntitlement") === "1";
  const detailsFromCc = searchParams.get("details")?.trim() ?? "";

  const baseRows = useMemo(() => {
    if (!singleEntitlement) return defaultRows;
    const name =
      detailsFromCc ||
      defaultRows[0].entitlement;
    return [
      {
        id: "owner-inactive-1",
        entitlement: name,
        entitlementDescription: OWNER_INACTIVE_DESCRIPTION,
        entitlementType: "Group",
        account: "svc_entitlement_01",
        applicationName: "SAP_S4",
        lastLogin: "03/21/25",
      },
    ];
  }, [singleEntitlement, detailsFromCc]);

  // Expand each row into main + description row, like Entitlement Owner
  const rowData = useMemo(
    () =>
      baseRows.flatMap((item) => [
        item,
        { ...item, __isDescRow: true, id: `${item.id}-desc` },
      ]),
    [baseRows]
  );

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-5 px-0 md:px-0">
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        {/* Filters + search row (copied pattern from TreeClient) */}
        <div className="flex items-center justify-between flex-wrap gap-3 w-full mb-3">
          <div className="flex items-center gap-4 flex-wrap w-full">
            <label className="inline-flex items-center gap-1 cursor-pointer text-gray-700 text-xs">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Select All</span>
            </label>
            <input
              type="text"
              placeholder="Search entitlements..."
              className="border rounded px-3 py-1 w-64 text-xs"
            />
            <Filters
              appliedFilter={() => {}}
              onFilterChange={() => {}}
              context="status"
              initialSelected="Pending"
            />
          </div>
        </div>

        {/* Entitlements grid */}
        <div className="ag-theme-alpine w-full">
          <AgGridReact
            theme={themeQuartz}
            rowData={rowData}
            columnDefs={entitlementColumns(reviewerId, certId)}
            domLayout="autoHeight"
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              flex: 1,
            }}
            rowSelection={{ mode: "multiRow" }}
            getRowId={(p) => p.data?.id}
          />
        </div>
      </div>
    </div>
  );
}

function entitlementColumns(
  reviewerId: string,
  certId: string
): ColDef[] {
  return [
    {
      headerName: "Entitlement",
      field: "entitlement",
      flex: 2,
      minWidth: 260,
      wrapText: true,
      autoHeight: true,
      colSpan: (params) => (params.data?.__isDescRow ? 7 : 1),
      cellRenderer: (params: ICellRendererParams) => {
        const { entitlement, entitlementDescription, __isDescRow } =
          params.data || {};

        if (__isDescRow) {
          const desc = entitlementDescription || "No description available";
          const isEmpty =
            !entitlementDescription ||
            entitlementDescription.trim().length === 0;
          return (
            <div
              className={`text-xs md:text-sm w-full break-words whitespace-pre-wrap ${
                isEmpty ? "text-gray-400 italic" : "text-gray-600"
              }`}
            >
              {isEmpty ? "No description available" : desc}
            </div>
          );
        }

        return (
          <div className="flex flex-col py-1">
            <span className="text-xs md:text-sm font-medium text-gray-900">
              {entitlement}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Type",
      field: "entitlementType",
      width: 120,
      flex: 0,
    },
    {
      headerName: "Account",
      field: "account",
      width: 160,
      flex: 0,
    },
    {
      headerName: "Application",
      field: "applicationName",
      width: 140,
      flex: 0,
    },
    {
      headerName: "Last Login",
      field: "lastLogin",
      width: 140,
      flex: 0,
    },
    {
      headerName: "Insights",
      field: "insights",
      minWidth: 140,
      width: 140,
      flex: 0,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellRenderer: () => (
        <div className="flex items-center justify-center text-amber-500">
          <Lightbulb size={20} />
        </div>
      ),
    },
    {
      headerName: "Actions",
      field: "actions",
      width: 260,
      minWidth: 260,
      flex: 0,
      cellRenderer: (params: ICellRendererParams) => (
        <ActionButtons
          api={params.api}
          selectedRows={[params.data]}
          context="entitlement"
          reviewerId={reviewerId}
          certId={certId}
          hideTeamsIcon={false}
        />
      ),
    },
  ];
}

