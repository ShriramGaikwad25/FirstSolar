"use client";

import React, { useEffect, useMemo, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import dynamic from "next/dynamic";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import {
  Ban,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  Repeat,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Sliders,
  Undo2,
  UserRoundCheckIcon,
} from "lucide-react";
import "@/lib/ag-grid-setup";
import { useRouter } from "next/navigation";
import sodViolations from "@/public/SodVoilations.json";
import continuousComplianceJson from "@/public/ContinousCompliance.json";
import AssuranceEventsTab from "@/components/continuous-compliance/AssuranceEventsTab";

type CcJsonRow = {
  Entity?: string;
  Details?: string;
  "Trigger Event"?: string;
  "Event Type"?: string;
  "Assigned To"?: string;
  "Expires On"?: string;
  Actions?: string;
};

function formatExpiresOnDisplay(value: string): string {
  const s = value.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${m}/${d}/${y}`;
  }
  return s;
}

function mapContinuousComplianceRow(item: CcJsonRow) {
  const actionsText = item?.Actions ?? "";
  const actions =
    typeof actionsText === "string"
      ? actionsText.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const expiresRaw = String(item?.["Expires On"] ?? "").trim();
  const dueDisplay = formatExpiresOnDisplay(expiresRaw);
  return {
    ...item,
    entity: String(item?.Entity ?? ""),
    details: String(item?.Details ?? ""),
    triggerEvent: String(item?.["Trigger Event"] ?? ""),
    eventType: String(item?.["Event Type"] ?? ""),
    actionType: String(item?.["Event Type"] ?? ""),
    assignedTo: String(item?.["Assigned To"] ?? ""),
    dueOn: dueDisplay,
    expiresOn: dueDisplay,
    actions,
  };
}

const ccPayload = continuousComplianceJson as { data?: CcJsonRow[] };
const ccRowsFromJson = Array.isArray(ccPayload.data)
  ? ccPayload.data.map(mapContinuousComplianceRow)
  : [];

function resolveSodViolationIdForCcRow(rowData: any): string {
  const list = Array.isArray(sodViolations) ? sodViolations : [];
  const details = String(rowData?.details ?? "").trim();
  const d = details.toLowerCase();
  if (d) {
    const byUser = list.find(
      (v: any) =>
        String(v.Identity ?? "").toLowerCase() === d ||
        String(v.Username ?? "").toLowerCase() === d ||
        String(v.Identity ?? "").toLowerCase().includes(d) ||
        String(v.Username ?? "").toLowerCase().includes(d)
    );
    if (byUser?.Violation_ID) return String(byUser.Violation_ID);
    const byPolicy = list.find(
      (v: any) => String(v.Policy_ID ?? "").toLowerCase() === d
    );
    if (byPolicy?.Violation_ID) return String(byPolicy.Violation_ID);
  }
  const first = list[0] as { Violation_ID?: string } | undefined;
  return first?.Violation_ID ? String(first.Violation_ID) : "V0001";
}

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

export default function ContinuousCompliancePage() {
  const router = useRouter();
  const rows = ccRowsFromJson;
  const [activeTab, setActiveTab] = useState(0); // 0 = Review Events, 1 = Assurance Events
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Review Events tab shows all rows from public/ContinousCompliance.json.
  const openRows = rows;

  const filteredOpenRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return openRows;

    const rowMatchesSearch = (r: any) => {
      const entries = Object.entries(r ?? {});
      for (const [key, value] of entries) {
        // Match key names too (useful if user searches for "ZNew_Comp_PP4")
        if (String(key).toLowerCase().includes(q)) return true;

        if (value === null || value === undefined) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          if (String(value).toLowerCase().includes(q)) return true;
          continue;
        }

        if (Array.isArray(value)) {
          if (
            value.some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
          ) {
            return true;
          }
          continue;
        }

        // Fallback for unexpected objects
        try {
          if (JSON.stringify(value).toLowerCase().includes(q)) return true;
        } catch {
          // ignore
        }
      }
      return false;
    };

    return openRows.filter((r) => rowMatchesSearch(r));
  }, [openRows, searchTerm]);

  // Keep Review Events as the safe default view when data loads.
  useEffect(() => {
    if (rows.length > 0) {
      setActiveTab(0);
    }
  }, [rows.length]);

  const handleReviewClick = (rowData: any) => {
    if (
      String(rowData?.entity ?? "") === "API Key" &&
      String(rowData?.details ?? "").trim() === "AK-982734"
    ) {
      router.push(
        "/campaigns/continuous-compliance/api-key-rotation-review"
      );
      return;
    }

    if (
      String(rowData?.entity ?? "") === "Secret" &&
      String(rowData?.details ?? "").trim() === "SEC-449821"
    ) {
      router.push(
        "/campaigns/continuous-compliance/secret-inactivity-review"
      );
      return;
    }

    const triggerEventValue =
      rowData?.triggerEvent ?? rowData?.eventType ?? "";
    const triggerEventStr = String(triggerEventValue ?? "");
    const isSodViolationDetected = /sod\s*violation\s*detected/i.test(
      triggerEventStr
    );
    const entityStr = String(rowData?.entity ?? "");
    const isSodCcEntity =
      entityStr === "User" || entityStr === "SoD Policy";

    // SoD violation from Continuous Compliance → SoD audit review (detail) with CC row context
    if (isSodViolationDetected && isSodCcEntity) {
      const violationId =
        String(rowData?.violationId ?? "").trim() ||
        resolveSodViolationIdForCcRow(rowData);
      const params = new URLSearchParams({
        source: "continuous-compliance",
        ccEntity: entityStr,
        ccDetails: String(rowData?.details ?? ""),
        ccTriggerEvent: triggerEventStr,
        ccActionType: String(
          rowData?.actionType ?? rowData?.eventType ?? ""
        ),
        ccDueOn: String(rowData?.expiresOn ?? rowData?.dueOn ?? ""),
        ccAssignedTo: String(rowData?.assignedTo ?? ""),
      });
      router.push(
        `/reports/sod-audit/${encodeURIComponent(violationId)}?${params.toString()}`
      );
      return;
    }

    const isManagerInactive = /manager\s*inactive/i.test(triggerEventStr);

    // Manager inactive → /user-style table with 5 direct reports, reassignment + Teams
    if (rowData?.entity === "User" && isManagerInactive) {
      const params = new URLSearchParams({
        triggerEvent: triggerEventStr,
        entity: rowData.entity ?? "",
        details: String(rowData?.details ?? ""),
        inactiveManager: String(rowData?.details ?? ""),
        assignedTo: String(rowData?.assignedTo ?? ""),
        dueOn: String(rowData?.expiresOn ?? rowData?.dueOn ?? ""),
        actionType: String(rowData?.actionType ?? rowData?.eventType ?? ""),
      });
      router.push(
        `/campaigns/continuous-compliance/manager-inactive-review?${params.toString()}`
      );
      return;
    }

    const isAccountInactive = /account\s*inactive/i.test(triggerEventStr);

    // Account inactive (user) → accounts on top with entitlements nested; actions on account row
    if (rowData?.entity === "User" && isAccountInactive) {
      const params = new URLSearchParams({
        triggerEvent: triggerEventStr,
        entity: rowData.entity ?? "",
        details: String(rowData?.details ?? ""),
        assignedTo: String(rowData?.assignedTo ?? ""),
        dueOn: String(rowData?.expiresOn ?? rowData?.dueOn ?? ""),
        actionType: String(rowData?.actionType ?? rowData?.eventType ?? ""),
      });
      router.push(
        `/campaigns/continuous-compliance/account-inactive-review?${params.toString()}`
      );
      return;
    }

    // User lifecycle events → open dummy Continuous Compliance review page
    if (rowData?.entity === "User") {
      const params = new URLSearchParams({
        triggerEvent: triggerEventValue,
        entity: rowData.entity ?? "",
        details: rowData.details ?? "",
        actionType: String(rowData?.actionType ?? rowData?.eventType ?? ""),
      });

      router.push(
        `/campaigns/continuous-compliance/review?${params.toString()}`
      );
      return;
    }

    const isNewlyDiscoveredEntitlement =
      /newly\s*discovered\s*entitlement/i.test(triggerEventStr);

    // Newly discovered entitlement → entitlements table (3 rows), Application + edit/approve/reassign
    if (rowData?.entity === "Entitlement" && isNewlyDiscoveredEntitlement) {
      const params = new URLSearchParams({
        triggerEvent: triggerEventStr,
        entity: rowData.entity ?? "",
        details: String(rowData?.details ?? ""),
        assignedTo: String(rowData?.assignedTo ?? ""),
        dueOn: String(rowData?.expiresOn ?? rowData?.dueOn ?? ""),
        actionType: String(rowData?.actionType ?? rowData?.eventType ?? ""),
      });
      router.push(
        `/campaigns/continuous-compliance/newly-discovered-entitlement-review?${params.toString()}`
      );
      return;
    }

    const isEntitlementOwnerInactive =
      rowData?.entity === "Entitlement" &&
      (/owner\s*inactive/i.test(triggerEventStr) ||
        /entitlement\s+owner\s*inactive/i.test(triggerEventStr));

    // Entitlement owner inactive → catalog grid (single entitlement row, edit + reassign)
    if (isEntitlementOwnerInactive) {
      const params = new URLSearchParams({
        ccOwnerInactive: "1",
        triggerEvent: triggerEventStr,
        entity: rowData.entity ?? "",
        details: String(rowData?.details ?? ""),
        assignedTo: String(rowData?.assignedTo ?? ""),
        dueOn: String(rowData?.expiresOn ?? rowData?.dueOn ?? ""),
        actionType: String(rowData?.actionType ?? rowData?.eventType ?? ""),
      });
      const reviewer = String(rowData?.assignedTo ?? "").trim();
      if (reviewer) params.set("reviewerId", reviewer);
      router.push(`/catalog?${params.toString()}`);
      return;
    }

    const isServiceAccountOwnerInactive =
      rowData?.entity === "Service Account" &&
      (/owner\s*inactive/i.test(triggerEventStr) ||
        /service\s*account\s+owner\s*inactive/i.test(triggerEventStr));

    // Service account owner inactive → Applications Accounts service-account grid (View + Reassign only)
    if (isServiceAccountOwnerInactive) {
      const params = new URLSearchParams({
        triggerEvent: triggerEventStr,
        entity: rowData.entity ?? "",
        details: String(rowData?.details ?? ""),
        assignedTo: String(rowData?.assignedTo ?? ""),
        dueOn: String(rowData?.expiresOn ?? rowData?.dueOn ?? ""),
        actionType: String(rowData?.actionType ?? rowData?.eventType ?? ""),
      });
      router.push(
        `/campaigns/continuous-compliance/service-account-owner-inactive-review?${params.toString()}`
      );
      return;
    }

    // Entitlement events → open dummy Entitlement Owner-style page (not live entitlement-owner)
    if (rowData?.entity === "Entitlement" || rowData?.entity === "Service Account") {
      const params = new URLSearchParams({
        reviewerId: "DUMMY_REVIEWER",
        certificationId: "DUMMY_CERT",
        appinstanceid: "DUMMY_APP_INSTANCE",
      });
      router.push(`/campaigns/continuous-compliance/entitlement-review?${params.toString()}`);
      return;
    }

    // Account events → open dummy Unlinked Accounts table page
    if (rowData?.entity === "Account") {
      router.push(`/campaigns/continuous-compliance/unlinked-accounts`);
      return;
    }

    // Fallback for other rows: keep placeholder behavior
    // eslint-disable-next-line no-console
    console.log("Review clicked", rowData);
  };

  const columnDefs: ColDef[] = [
    { headerName: "Entity", field: "entity", flex: 1 },
    { headerName: "Details", field: "details", flex: 1 },
    {
      headerName: "Trigger Event",
      field: "triggerEvent",
      valueGetter: (p) =>
        p.data?.triggerEvent ?? p.data?.eventType ?? "",
      flex: 2,
      wrapText: true,
      autoHeight: true,
    },
    {
      headerName: "Event Type",
      field: "eventType",
      valueGetter: (p) => p.data?.actionType ?? p.data?.eventType ?? "",
      flex: 1.4,
      wrapText: true,
    },
    {
      headerName: "Assigned To",
      field: "assignedTo",
      valueGetter: (p) => p.data?.assignedTo ?? "",
      flex: 1,
    },
    {
      headerName: "Expires On",
      field: "expiresOn",
      valueGetter: (p) => p.data?.expiresOn ?? p.data?.dueOn ?? "",
      flex: 1.2,
    },
    {
      headerName: "Action",
      field: "actions",
      flex: 1.1,
      width: 200,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const value = params.value as string[] | string | undefined;

        const actions = Array.isArray(value)
          ? value
          : typeof value === "string"
            ? value.split(",").map((s) => s.trim())
            : [];

        const has = (pattern: RegExp) => actions.some((a) => pattern.test(String(a)));

        const hasReview = has(/^review$/i);
        const hasReassign = has(/^reassign$/i);
        const hasRevokeAccess = has(/revoke/i);
        const hasAdjustAccess = has(/adjust\s*access/i);
        const hasEnforceMfa = has(/enforce\s*mfa/i);
        const hasDisable = has(/^disable$/i);
        const hasMitigating = has(/mitigate/i);
        const hasRationalize = has(/rationalize/i);
        const hasRotate = has(/^rotate$/i);
        const hasRestore = has(/restore/i);

        const onActionClick = (actionName: string) => {
          const data = params.data;
          if (
            actionName === "Rotate" &&
            String(data?.entity ?? "") === "API Key" &&
            String(data?.details ?? "").trim() === "AK-982734"
          ) {
            router.push(
              "/campaigns/continuous-compliance/api-key-rotation-review"
            );
            return;
          }
          if (
            actionName === "Disable" &&
            String(data?.entity ?? "") === "Secret" &&
            String(data?.details ?? "").trim() === "SEC-449821"
          ) {
            router.push(
              "/campaigns/continuous-compliance/secret-inactivity-review"
            );
            return;
          }
          // eslint-disable-next-line no-console
          console.log(`${actionName} clicked`, data);
        };

        return (
          <div
            className="flex items-center gap-2 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {hasReview && (
              <button
                type="button"
                title="Review"
                aria-label="Review"
                className="p-1 rounded transition-colors duration-200 hover:bg-green-50"
                onClick={() => handleReviewClick(params.data)}
              >
                <FileText
                  className="cursor-pointer"
                  color="#2563eb"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasReassign && (
              <button
                type="button"
                title="Reassign"
                aria-label="Reassign"
                className="p-1 rounded transition-colors duration-200 hover:bg-purple-50"
                onClick={() => onActionClick("Reassign")}
              >
                <UserRoundCheckIcon
                  className="cursor-pointer"
                  color="#b146ccff"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasRevokeAccess && (
              <button
                type="button"
                title="Revoke Access"
                aria-label="Revoke Access"
                className="p-1 rounded transition-colors duration-200 hover:bg-red-50"
                onClick={() => onActionClick("Revoke Access")}
              >
                <ShieldX
                  className="cursor-pointer"
                  color="#dc2626"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasAdjustAccess && (
              <button
                type="button"
                title="Adjust Access"
                aria-label="Adjust Access"
                className="p-1 rounded transition-colors duration-200 hover:bg-amber-50"
                onClick={() => onActionClick("Adjust Access")}
              >
                <Sliders
                  className="cursor-pointer"
                  color="#d97706"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasEnforceMfa && (
              <button
                type="button"
                title="Enforce MFA"
                aria-label="Enforce MFA"
                className="p-1 rounded transition-colors duration-200 hover:bg-indigo-50"
                onClick={() => onActionClick("Enforce MFA")}
              >
                <Lock
                  className="cursor-pointer"
                  color="#4f46e5"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasDisable && (
              <button
                type="button"
                title="Disable"
                aria-label="Disable"
                className="p-1 rounded transition-colors duration-200 hover:bg-gray-50"
                onClick={() => onActionClick("Disable")}
              >
                <Ban
                  className="cursor-pointer"
                  color="#6b7280"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasMitigating && (
              <button
                type="button"
                title="Mitigating"
                aria-label="Mitigating"
                className="p-1 rounded transition-colors duration-200 hover:bg-emerald-50"
                onClick={() => onActionClick("Mitigating")}
              >
                <ShieldCheck
                  className="cursor-pointer"
                  color="#059669"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasRationalize && (
              <button
                type="button"
                title="Rationalize"
                aria-label="Rationalize"
                className="p-1 rounded transition-colors duration-200 hover:bg-teal-50"
                onClick={() => onActionClick("Rationalize")}
              >
                <Repeat
                  className="cursor-pointer"
                  color="#0f766e"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasRotate && (
              <button
                type="button"
                title="Rotate"
                aria-label="Rotate"
                className="p-1 rounded transition-colors duration-200 hover:bg-indigo-50"
                onClick={() => onActionClick("Rotate")}
              >
                <RotateCcw
                  className="cursor-pointer"
                  color="#4f46e5"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}

            {hasRestore && (
              <button
                type="button"
                title="Restore"
                aria-label="Restore"
                className="p-1 rounded transition-colors duration-200 hover:bg-cyan-50"
                onClick={() => onActionClick("Restore")}
              >
                <Undo2
                  className="cursor-pointer"
                  color="#0891b2"
                  strokeWidth={1}
                  size={22}
                />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mt-4">
            {/* Open / Complete tabs (inline to avoid remounting input on every keystroke) */}
            <div
              role="tablist"
              aria-label="Continuous Compliance Tabs"
              className="flex flex-shrink-0 gap-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 0}
                onClick={() => setActiveTab(0)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTab === 0
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {activeTab === 0 ? (
                  <ChevronDown size={16} className="text-white" />
                ) : (
                  <ChevronUp size={16} className="text-gray-500" />
                )}
                Review Events
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 1}
                onClick={() => setActiveTab(1)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTab === 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {activeTab === 1 ? (
                  <ChevronDown size={16} className="text-white" />
                ) : (
                  <ChevronUp size={16} className="text-gray-500" />
                )}
                Assurance Events
              </button>
            </div>

            {/* Tab panel */}
            <div role="tabpanel" className="mt-4 flex flex-col">
              {activeTab === 0 ? (
                <div className="w-full flex flex-col">
                  <div className="mb-3 flex items-center gap-3 justify-between flex-wrap">
                    <div
                      className="relative bg-white rounded-md border border-gray-300"
                      style={{
                        display: "flex",
                        padding: "6px 10px",
                        alignItems: "center",
                        gap: "8px",
                        alignSelf: "stretch",
                        flex: "1 1 320px",
                        minWidth: 260,
                      }}
                    >
                      <Search className="text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border-0 bg-transparent text-gray-700 focus:outline-none flex-1"
                      />
                    </div>
                  </div>

                  <div className="ag-theme-alpine w-full">
                    <AgGridReact
                      theme={themeQuartz}
                      rowData={filteredOpenRows}
                      columnDefs={columnDefs}
                      defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true,
                        flex: 1,
                      }}
                      domLayout="autoHeight"
                    />
                  </div>
                  {filteredOpenRows.length === 0 && (
                    <div className="mt-3 text-sm text-gray-500">
                      No records found.
                    </div>
                  )}
                </div>
              ) : (
                <AssuranceEventsTab />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

