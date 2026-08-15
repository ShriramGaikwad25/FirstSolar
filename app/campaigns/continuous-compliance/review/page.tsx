"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { themeQuartz } from "ag-grid-community";
import Image from "next/image";
import { MoreVertical } from "lucide-react";
import Filters from "@/components/agTable/Filters";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import type { ColDef } from "ag-grid-community";
import { Lightbulb } from "lucide-react";
import ActionButtons from "@/components/agTable/ActionButtons";

/** User manager change (default) – multiple accounts / apps; privileged & new-account use one of each. */
const MANAGER_CHANGE_ENTITLEMENTS = [
  {
    entitlement: "Z_FI_HR_PAYROLL",
    entitlementDescription:
      "Executes financial postings, inquiries, and period controls. Ensures balance integrity, reconciliations, and approvals under governed workflows.",
    type: "Group",
    account: "svc_payroll_01",
    application: "SAP_S4",
    lastLogin: "03/21/25",
  },
  {
    entitlement: "ZNEW_FICA_MGR_REV_ACC",
    entitlementDescription:
      "Supports financial postings, inquiries, and period controls. Ensures balance integrity, reconciliations, and approvals under governed workflows.",
    type: "Group",
    account: "svc_fica_mgr_01",
    application: "SAP_S4",
    lastLogin: "03/21/25",
  },
  {
    entitlement: "ZNEW_DM_REVENUE_ACC",
    entitlementDescription:
      "Executes directory group membership for routing access. Ensures SSO mapping and least-privilege entitlement under governed workflows.",
    type: "Group",
    account: "svc_revenue_01",
    application: "SAP_S4",
    lastLogin: "03/21/25",
  },
];

const SHARED_ACCOUNT = "Ssharma_SAP01";
const PRIVILEGED_FLOW_ACCOUNT = "john.kelly";
const SHARED_APPLICATION = "SAP_S4";

/** Display name on user card: "john.kelly" → "John Kelly" */
function formatDetailsDisplayName(raw: string): string {
  const s = raw.trim();
  if (!s) return "John Kelly";
  if (s.includes(".")) {
    return s
      .split(".")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  }
  return s;
}

/** Privileged Access assigned & New Account assigned: one account, one application, multiple entitlements. */
const SINGLE_ACCOUNT_ENTITLEMENT_ROWS = [
  {
    entitlement: "ZPRIV_GL_BREAKGLASS",
    entitlementDescription:
      "Emergency privileged break-glass access for controlled financial close and reconciliation windows.",
    type: "Role",
  },
  {
    entitlement: "ZADMIN_FI_POSTING_CTRL",
    entitlementDescription:
      "Posts journal entries and manages period-end controls under dual-control policy.",
    type: "Group",
  },
  {
    entitlement: "ZPRIV_PAYROLL_APPROVE",
    entitlementDescription:
      "Approves payroll runs and sensitive compensation adjustments within HR/payroll module.",
    type: "Role",
  },
  {
    entitlement: "ZSEC_USER_ADMIN_EXT",
    entitlementDescription:
      "Extended user administration for application security roles and emergency access requests.",
    type: "Group",
  },
  {
    entitlement: "ZAUDIT_SOX_EXTRACT",
    entitlementDescription:
      "Read-only extraction and reporting for SOX-relevant audit trails and configuration snapshots.",
    type: "Group",
  },
];

export default function ContinuousComplianceDummyReviewPage() {
  const searchParams = useSearchParams();

  const detailsParam = searchParams.get("details") ?? "";
  const name = formatDetailsDisplayName(detailsParam);
  const jobTitle = "Senior Operations Analyst";
  const department = "IT Operations";
  const completionPercent = 92;

  const triggerEvent = searchParams.get("triggerEvent") ?? "";
  const actionType = (searchParams.get("actionType") ?? "").trim();
  const isPrivilegedAccessAssigned =
    /privelege\s*access\s*assigned|privileged\s*access\s*assigned/i.test(
      triggerEvent
    );
  const hideUserCardProgress =
    /^access\s*review$/i.test(actionType) || isPrivilegedAccessAssigned;
  const isNewAccountAssigned =
    /new\s*account\s*(discovered|assigned)/i.test(triggerEvent);

  const baseDummyEntitlements = useMemo(() => {
    if (isPrivilegedAccessAssigned || isNewAccountAssigned) {
      const rows = isPrivilegedAccessAssigned
        ? SINGLE_ACCOUNT_ENTITLEMENT_ROWS.slice(0, 3)
        : SINGLE_ACCOUNT_ENTITLEMENT_ROWS;
      return rows.map((row) => ({
        ...row,
        account: isPrivilegedAccessAssigned
          ? PRIVILEGED_FLOW_ACCOUNT
          : SHARED_ACCOUNT,
        application: SHARED_APPLICATION,
        ...(isNewAccountAssigned
          ? {}
          : { lastLogin: "03/21/25" as const }),
      }));
    }
    return MANAGER_CHANGE_ENTITLEMENTS;
  }, [isPrivilegedAccessAssigned, isNewAccountAssigned]);

  const entitlementColumns = useMemo(
    () => buildEntitlementColumns(!isNewAccountAssigned),
    [isNewAccountAssigned]
  );

  // Expand into main + description rows, like TreeClient does
  const dummyEntitlements = baseDummyEntitlements.flatMap((row, index) => [
    {
      id: `row-${index}`,
      ...row,
      __isDescRow: false,
    },
    {
      id: `row-${index}-desc`,
      entitlement: row.entitlement,
      entitlementDescription: row.entitlementDescription,
      __isDescRow: true,
    },
  ]);

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-5 px-0 md:px-0">
      {/* Card section: user header + filters + search row (card spans full width) */}
      <div className="w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 pt-4 pb-3">
          {/* User header row */}
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Avatar */}
            <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-white shadow">
              <Image
                src="/User.jpg"
                alt={name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>

            {/* Name, progress, job title, department (all inline row) */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status + name */}
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
                    {name}
                  </p>
                </div>

                {/* Progress (hidden for Event Type = Access Review) */}
                {!hideUserCardProgress && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 md:w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2563eb] rounded-full"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] md:text-xs font-medium text-gray-700">
                      {completionPercent}%
                    </span>
                  </div>
                )}

                {/* Job title + department chips – larger and inline */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] md:text-xs">
                  <span className="text-gray-500">Job Title:</span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 border border-blue-100">
                    {jobTitle}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">Department:</span>
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 font-medium text-purple-700 border border-purple-100">
                    {department}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: three-dot menu icon */}
            <button
              type="button"
              className="ml-2 p-1 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>
          </div>

          {/* Divider */}
          <div className="mt-4 border-t border-gray-100" />

          {/* Filters row - slightly larger */}
          <div className="mt-4 flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
            <span className="text-gray-500 font-medium">Filters:</span>
            <button className="px-3 py-1 rounded-full bg-gray-100 text-[11px] md:text-xs text-gray-400 cursor-default">
              Dormant Accounts
            </button>
            <button className="px-3 py-1 rounded-full bg-gray-100 text-[11px] md:text-xs text-gray-400 cursor-default">
              Violation
            </button>
            <button className="px-3 py-1 rounded-full bg-gray-100 text-[11px] md:text-xs text-gray-400 cursor-default">
              High Risk
            </button>
            <button className="px-3 py-1 rounded-full bg-gray-100 text-[11px] md:text-xs text-gray-400 cursor-default">
              Delta Access
            </button>
          </div>

          {/* Search row + status filter (TreeClient-style Filters component) */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1 cursor-pointer text-gray-700">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Select All</span>
            </label>

            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <input
                type="text"
                placeholder="Search entitlements..."
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status filter using shared Filters component (status context) */}
            <Filters
              appliedFilter={() => {}}
              onFilterChange={() => {}}
              context="status"
              initialSelected="Pending"
            />
          </div>
        </div>
      </div>

      {/* Entitlements grid section – reuse AgGrid like TreeClient */}
      <div className="mt-4 w-full bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div className="ag-theme-alpine w-full">
          <AgGridReact
            theme={themeQuartz}
            rowData={dummyEntitlements}
            columnDefs={entitlementColumns}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              flex: 1,
            }}
            domLayout="autoHeight"
          />
        </div>
      </div>
    </div>
  );
}

function buildEntitlementColumns(includeLastLogin: boolean): ColDef[] {
  const descColSpan = includeLastLogin ? 7 : 6;

  return [
    {
      headerName: "Entitlement",
      field: "entitlement",
      flex: 2,
      minWidth: 260,
      wrapText: true,
      autoHeight: true,
      cellRenderer: (params) => {
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
      colSpan: (params) => {
        if (!params.data?.__isDescRow) return 1;
        return descColSpan;
      },
    },
    {
      headerName: "Type",
      field: "type",
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
      field: "application",
      width: 140,
      flex: 0,
    },
    ...(includeLastLogin
      ? ([
          {
            headerName: "Last Login",
            field: "lastLogin",
            width: 140,
            flex: 0,
          },
        ] as ColDef[])
      : []),
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
      cellRenderer: (params) => (
        <ActionButtons
          api={params.api}
          selectedRows={[params.data]}
          context="entitlement"
          reviewerId="DUMMY_REVIEWER"
          certId="DUMMY_CERT"
          hideTeamsIcon={false}
        />
      ),
    },
  ];
}

