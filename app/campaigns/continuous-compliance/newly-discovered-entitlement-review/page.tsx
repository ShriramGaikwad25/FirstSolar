"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { themeQuartz } from "ag-grid-community";
import { CircleCheck, Pencil, UserRoundCheck } from "lucide-react";
import "@/lib/ag-grid-setup";
import CustomPagination from "@/components/agTable/CustomPagination";
import EntitlementDetailsSidebar from "@/components/agTable/EntitlementDetailsSidebar";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import ProxyActionModal from "@/components/ProxyActionModal";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

type EntRow = {
  id: string;
  entitlement: string;
  type: string;
  application: string;
  /** Display in grid (e.g. 03/15/26) */
  lastSync: string;
};

const INITIAL_ROWS: EntRow[] = [
  {
    id: "nde-1",
    entitlement: "ZNEW_FI_CRITICAL",
    type: "Role",
    application: "SAP",
    lastSync: "03/15/26",
  },
  {
    id: "nde-2",
    entitlement: "Z_FI_AA_TRANS",
    type: "Group",
    application: "SAP",
    lastSync: "03/15/26",
  },
  {
    id: "nde-3",
    entitlement: "ZNEW_DM_REVENUE_ACC",
    type: "Role",
    application: "SAP",
    lastSync: "03/15/26",
  },
];

/** Maps table row to entitlement-details sidebar field shape (SAP / catalog-style keys). */
function entRowToDetailsData(row: EntRow): Record<string, unknown> {
  return {
    "Ent Name": row.entitlement,
    "Ent Description":
      "Newly discovered SAP entitlement — enter or confirm details before approval.",
    "Ent Type": row.type,
    "App Name": row.application,
    "Last Sync": "2026-03-15",
    "Total Assignments": "0",
    "Dynamic Tag": "",
    "Business Objective": "",
    "Business Unit": "",
    "Ent Owner": "",
    "Compliance Type": "",
    "Data Classification": "",
    "Cost Center": "",
    "Created On": "2026-03-15",
    "App Instance": "",
    "App Owner": "",
    "Hierarchy": "",
    "MFA Status": "",
    assignment: "",
    "License Type": "",
    Risk: "Medium",
    Certifiable: "Yes",
    "Revoke on Disable": "",
    "Shared Pwd": "",
    "SOD Check": "",
    "Access Scope": "",
    "Review Schedule": "",
    "Last Reviewed on": "",
    Privileged: "",
    "Non Persistent Access": "",
    "Audit Comments": "",
    "Account Type Restriction": "",
    Requestable: "",
    "Pre- Requisite": "",
    "Pre-Requisite Details": "",
    "Auto Assign Access Policy": "",
    "Provisioner Group": "",
    "Provisioning Steps": "",
    "Provisioning Mechanism": "",
    "Action on Native Change": "",
  };
}

function mergeDetailsIntoRow(row: EntRow, edited: Record<string, unknown>): EntRow {
  return {
    ...row,
    entitlement: String(edited["Ent Name"] ?? row.entitlement),
    type: String(edited["Ent Type"] ?? row.type),
    application: String(edited["App Name"] ?? row.application),
  };
}

type GridCtx = {
  updateRow: (id: string, updater: (prev: EntRow) => EntRow) => void;
  requestReassign: (row: EntRow) => void;
};

function NewlyDiscoveredActionsCell(props: ICellRendererParams<EntRow, unknown, GridCtx>) {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const row = props.data;
  const ctx = props.context;

  if (!row || !ctx?.updateRow) return null;

  const openEdit = () => {
    openSidebar(
      <EntitlementDetailsSidebar
        data={entRowToDetailsData(row)}
        errorMessage={null}
        editModeInitial
        onSave={(edited) => {
          ctx.updateRow(row.id, (prev) => mergeDetailsIntoRow(prev, edited as Record<string, unknown>));
          closeSidebar();
          alert("Changes saved successfully");
        }}
        onClose={closeSidebar}
      />,
      { widthPx: 500, title: "Edit Entitlement" }
    );
  };

  return (
    <div
      className="flex items-center gap-2 h-full py-1 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Edit"
        aria-label="Edit entitlement details"
        className="p-1 rounded hover:bg-gray-100 text-gray-700"
        onClick={openEdit}
      >
        <Pencil className="w-4 h-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        title="Approve"
        aria-label="Approve"
        className="p-1 rounded hover:bg-green-50 text-emerald-700"
      >
        <CircleCheck className="w-5 h-5" strokeWidth={1.5} />
      </button>
        <button
          type="button"
          title="Reassign"
          aria-label="Reassign"
          className="p-1 rounded hover:bg-purple-50"
          onClick={() => ctx.requestReassign(row)}
        >
          <UserRoundCheck className="w-5 h-5" color="#b146cc" strokeWidth={1} />
        </button>
    </div>
  );
}

export default function NewlyDiscoveredEntitlementReviewPage() {
  const [rows, setRows] = useState<EntRow[]>(INITIAL_ROWS);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignRow, setReassignRow] = useState<EntRow | null>(null);

  const updateRow = useCallback((id: string, updater: (prev: EntRow) => EntRow) => {
    setRows((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
  }, []);

  const requestReassign = useCallback((row: EntRow) => {
    setReassignRow(row);
    setReassignOpen(true);
  }, []);

  const gridContext = useMemo<GridCtx>(
    () => ({ updateRow, requestReassign }),
    [updateRow, requestReassign]
  );

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.entitlement, r.type, r.application, r.lastSync].some((v) =>
        String(v).toLowerCase().includes(q)
      )
    );
  }, [rows, searchTerm]);

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);

  const paginatedRows = useMemo(() => {
    const start = (pageNumber - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageNumber, pageSize]);

  useEffect(() => {
    setPageNumber(1);
  }, [searchTerm, pageSize]);

  const columnDefs = useMemo<ColDef<EntRow>[]>(
    () => [
      {
        headerName: "Entitlement",
        field: "entitlement",
        flex: 2,
        minWidth: 220,
        cellRenderer: (params: { value?: string }) => (
          <span className="font-semibold text-gray-900">{params.value ?? ""}</span>
        ),
      },
      {
        headerName: "Type",
        field: "type",
        flex: 1,
        minWidth: 100,
      },
      {
        headerName: "Application",
        field: "application",
        flex: 1.2,
        minWidth: 130,
      },
      {
        headerName: "Last Sync",
        field: "lastSync",
        flex: 1,
        minWidth: 110,
      },
      {
        headerName: "Action",
        field: "action",
        flex: 1,
        minWidth: 200,
        sortable: false,
        filter: false,
        cellRenderer: NewlyDiscoveredActionsCell,
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-6 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Entitlements</h1>
            <p className="text-sm text-gray-600 mt-1">
              Newly discovered entitlement — review required (
              {totalItems === rows.length
                ? `${totalItems} shown`
                : `${totalItems} of ${rows.length} shown`}
              ).
            </p>
          </div>
          <div className="shrink-0">
            <input
              type="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-md px-3 py-1.5 w-full max-w-full sm:w-96 sm:max-w-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search entitlements"
            />
          </div>
        </div>

        <div className="mb-2">
          <CustomPagination
            totalItems={totalItems}
            currentPage={pageNumber}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPageNumber}
            onPageSizeChange={(n) => {
              if (n === "all") {
                setPageSize(totalItems || INITIAL_ROWS.length);
              } else if (typeof n === "number") {
                setPageSize(n);
              }
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm ag-theme-alpine">
          <AgGridReact
            theme={themeQuartz}
            rowData={paginatedRows}
            columnDefs={columnDefs}
            context={gridContext}
            domLayout="autoHeight"
            defaultColDef={{
              sortable: true,
              resizable: true,
              filter: true,
            }}
            getRowId={(p) => p.data.id}
            suppressRowClickSelection
          />
        </div>

        <div className="mt-3">
          <CustomPagination
            totalItems={totalItems}
            currentPage={pageNumber}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPageNumber}
            onPageSizeChange={(n) => {
              if (n === "all") {
                setPageSize(totalItems || INITIAL_ROWS.length);
              } else if (typeof n === "number") {
                setPageSize(n);
              }
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>

        <ProxyActionModal
          isModalOpen={reassignOpen}
          closeModal={() => {
            setReassignOpen(false);
            setReassignRow(null);
          }}
          heading="Reassign Task"
          users={[
            { username: "john", email: "john@example.com", role: "admin" },
            { username: "jane", email: "jane@example.com", role: "user" },
          ]}
          groups={[
            { name: "admins", email: "admins@corp.com", role: "admin" },
            { name: "devs", email: "devs@corp.com", role: "developer" },
          ]}
          userAttributes={[
            { value: "username", label: "Username" },
            { value: "email", label: "Email" },
          ]}
          groupAttributes={[
            { value: "name", label: "Group Name" },
            { value: "role", label: "Role" },
          ]}
          onSelectOwner={(assignee) => {
            setReassignOpen(false);
            setReassignRow(null);
            if (assignee) {
              const name = "username" in assignee ? assignee.username : assignee.name;
              const ent = reassignRow?.entitlement ?? "entitlement";
              alert(`Task for ${ent} reassigned to ${name}`);
            }
          }}
        />
      </div>
    </div>
  );
}
