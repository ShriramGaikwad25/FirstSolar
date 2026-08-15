"use client";

import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ChevronRight, MoreVertical } from "lucide-react";
import type { ColDef } from "ag-grid-community";
import type { GridApi } from "ag-grid-enterprise";
import { themeQuartz } from "ag-grid-community";
import Filters from "@/components/agTable/Filters";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import ActionButtons from "@/components/agTable/ActionButtons";

/** Stub satisfies ActionButtons’ truthy `api` check; handlers do not call grid APIs. */
const noopGridApi = {} as GridApi;

type EntitlementRow = {
  id: string;
  entitlement: string;
  entitlementDescription: string;
  type: string;
  application: string;
  lastLogin: string;
};

type AccountBlock = {
  id: string;
  lineItemId: string;
  accountName: string;
  application: string;
  lastLogin: string;
  daysInactive: number;
  status: string;
  entitlements: EntitlementRow[];
};

function buildMockAccounts(userKey: string): AccountBlock[] {
  const base = userKey.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "user";
  const sapLast = "09/12/2025";
  const sfdcLast = "08/01/2025";

  const entWithAccountLast = (
    rows: Omit<EntitlementRow, "lastLogin">[],
    accountLast: string
  ): EntitlementRow[] =>
    rows.map((r) => ({ ...r, lastLogin: accountLast }));

  return [
    {
      id: `${base}-acc-1`,
      lineItemId: `li-acc-${base}-1`,
      accountName: `${base}_sap_prod`,
      application: "SAP_S4",
      lastLogin: sapLast,
      daysInactive: 112,
      status: "Inactive",
      entitlements: entWithAccountLast(
        [
          {
            id: `${base}-e1`,
            entitlement: "Z_FI_GL_POSTING",
            entitlementDescription:
              "Financial posting and period close activities for assigned company codes.",
            type: "Role",
            application: "SAP_S4",
          },
          {
            id: `${base}-e2`,
            entitlement: "ZNEW_FICA_MGR_REV_ACC",
            entitlementDescription:
              "Manager review access for fiscal account structures and accruals.",
            type: "Group",
            application: "SAP_S4",
          },
        ],
        sapLast
      ),
    },
    {
      id: `${base}-acc-2`,
      lineItemId: `li-acc-${base}-2`,
      accountName: `${base}_salesforce`,
      application: "Salesforce",
      lastLogin: sfdcLast,
      daysInactive: 164,
      status: "Inactive",
      entitlements: entWithAccountLast(
        [
          {
            id: `${base}-e3`,
            entitlement: "SFDC_FINANCE_ADMIN",
            entitlementDescription:
              "Finance configuration and reporting objects in Salesforce.",
            type: "Permission Set",
            application: "Salesforce",
          },
          {
            id: `${base}-e4`,
            entitlement: "SFDC_CASE_APPROVER",
            entitlementDescription: "Case approval queues for regional operations.",
            type: "Permission Set",
            application: "Salesforce",
          },
        ],
        sfdcLast
      ),
    },
  ];
}

export default function AccountInactiveReviewPage() {
  const searchParams = useSearchParams();

  const name = searchParams.get("details") || "User";
  const triggerEvent = searchParams.get("triggerEvent") || "Account Inactive";
  const assignedTo = searchParams.get("assignedTo") || "";
  const dueOn = searchParams.get("dueOn") || "";

  const jobTitle = "Senior Operations Analyst";
  const department = "IT Operations";

  const accounts = useMemo(() => buildMockAccounts(name), [name]);

  /** `false` = collapsed; `undefined` / `true` = expanded */
  const [expandedByAccountId, setExpandedByAccountId] = useState<
    Record<string, boolean>
  >({});

  const isAccountExpanded = useCallback(
    (accountId: string) => expandedByAccountId[accountId] !== false,
    [expandedByAccountId]
  );

  const toggleAccount = useCallback((accountId: string) => {
    setExpandedByAccountId((prev) => ({
      ...prev,
      [accountId]: prev[accountId] === false,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-5 px-0 md:px-0">
      <div className="w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-white shadow shrink-0">
              <Image
                src="/User.jpg"
                alt={name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
                    {name}
                  </p>
                </div>

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

              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium text-gray-800">Event:</span> {triggerEvent}
                {assignedTo ? (
                  <>
                    {" "}
                    <span className="text-gray-400">·</span>{" "}
                    <span className="font-medium text-gray-800">Assigned:</span> {assignedTo}
                  </>
                ) : null}
                {dueOn ? (
                  <>
                    {" "}
                    <span className="text-gray-400">·</span>{" "}
                    <span className="font-medium text-gray-800">Due:</span> {dueOn}
                  </>
                ) : null}
              </p>
            </div>

            <button
              type="button"
              className="ml-2 p-1 rounded-full hover:bg-gray-100 text-gray-500 shrink-0"
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>
          </div>

          <div className="mt-4 border-t border-gray-100" />

          <div className="mt-4 flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
            <span className="text-gray-500 font-medium">Filters:</span>
            <button
              type="button"
              className="px-3 py-1 rounded-full bg-amber-50 text-[11px] md:text-xs text-amber-900 border border-amber-100 font-medium"
            >
              Account Inactive
            </button>
            <button className="px-3 py-1 rounded-full bg-gray-100 text-[11px] md:text-xs text-gray-400 cursor-default">
              Dormant Accounts
            </button>
            <button className="px-3 py-1 rounded-full bg-gray-100 text-[11px] md:text-xs text-gray-400 cursor-default">
              High Risk
            </button>
          </div>

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
                placeholder="Search accounts or entitlements..."
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <Filters
              appliedFilter={() => {}}
              onFilterChange={() => {}}
              context="status"
              initialSelected="Pending"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 w-full space-y-4">
        {accounts.map((account) => {
          const expanded = isAccountExpanded(account.id);
          return (
            <div
              key={account.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Account-level header: collapsible summary + actions (top) */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 bg-slate-50/80 border-b border-gray-100">
                <button
                  type="button"
                  id={`account-toggle-${account.id}`}
                  className="flex flex-1 min-w-0 gap-2 sm:gap-3 items-center text-left rounded-lg -m-1 p-1 hover:bg-slate-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  onClick={() => toggleAccount(account.id)}
                  aria-expanded={expanded}
                  aria-controls={`account-entitlements-${account.id}`}
                >
                  <ChevronRight
                    className={`w-5 h-5 shrink-0 text-gray-500 transition-transform duration-200 ${
                      expanded ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm flex-1 min-w-0">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Account
                      </div>
                      <div className="mt-0.5 font-semibold text-gray-900 break-all">
                        {account.accountName}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Application
                      </div>
                      <div className="mt-0.5 text-gray-900">{account.application}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Last login
                      </div>
                      <div className="mt-0.5 text-gray-900">{account.lastLogin}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Days inactive / Status
                      </div>
                      <div className="mt-0.5 text-gray-900">
                        {account.daysInactive} days · {account.status}
                      </div>
                    </div>
                  </div>
                </button>

                <div
                  className="flex shrink-0 items-center justify-end w-full sm:w-auto sm:min-w-[260px] border border-gray-100 rounded-lg bg-white px-2 py-1.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <ActionButtons
                    api={noopGridApi}
                    selectedRows={[
                      {
                        lineItemId: account.lineItemId,
                        id: account.id,
                        status: account.status,
                      },
                    ]}
                    context="account"
                    reviewerId="DUMMY_REVIEWER"
                    certId="DUMMY_CERT"
                    hideTeamsIcon={false}
                  />
                </div>
              </div>

              {/* Nested entitlements table */}
              {expanded ? (
                <div
                  id={`account-entitlements-${account.id}`}
                  className="p-3 pt-2 border-t border-gray-50"
                  role="region"
                  aria-labelledby={`account-toggle-${account.id}`}
                >
                  <div className="ag-theme-alpine w-full">
                    <AgGridReact
                      theme={themeQuartz}
                      rowData={account.entitlements}
                      columnDefs={nestedEntitlementColumns}
                      defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true,
                        flex: 1,
                      }}
                      domLayout="autoHeight"
                      getRowId={(p) => p.data.id}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nestedEntitlementColumns: ColDef[] = [
  {
    headerName: "Entitlement",
    field: "entitlement",
    flex: 1.2,
    minWidth: 200,
    wrapText: true,
    autoHeight: true,
    cellRenderer: (params: { value?: string }) => (
      <div className="py-1 text-xs md:text-sm font-medium text-gray-900">
        {params.value || "—"}
      </div>
    ),
  },
  {
    headerName: "Description",
    field: "entitlementDescription",
    flex: 2.2,
    minWidth: 260,
    wrapText: true,
    autoHeight: true,
    cellRenderer: (params: { value?: string }) => {
      const v = params.value?.trim();
      return (
        <div
          className={`py-1 text-xs md:text-sm break-words whitespace-normal leading-snug ${
            v ? "text-gray-700" : "text-gray-400 italic"
          }`}
        >
          {v || "No description available"}
        </div>
      );
    },
  },
  {
    headerName: "Type",
    field: "type",
    width: 120,
    flex: 0,
  },
  {
    headerName: "Application",
    field: "application",
    width: 140,
    flex: 0,
  },
  {
    headerName: "Last Login",
    field: "lastLogin",
    width: 120,
    flex: 0,
  },
];
