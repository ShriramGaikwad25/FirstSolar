"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { themeQuartz } from "ag-grid-community";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ArrowRight, ChevronDown, ChevronRight, UserRoundCheck } from "lucide-react";
import "@/lib/ag-grid-setup";
import { formatDateMMDDYY } from "@/utils/utils";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import CustomPagination from "@/components/agTable/CustomPagination";
import { executeQuery } from "@/lib/api";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

type ServiceAccountEntitlement = {
  entitlementName: string;
  entitlementDescription: string;
  lastlogindate: string;
  businessService: string;
  userManager: string;
};

/** Same entitlement names + copy as service accounts dummy data (`app/service-account/page.tsx`, `app/applications/[id]/page.tsx`). */
const SERVICE_ACCOUNT_ENTITLEMENT_SEED: Omit<
  ServiceAccountEntitlement,
  "userManager"
>[] = [
  {
    entitlementName: "Administrator Access",
    entitlementDescription:
      "Full administrative access to the production database system. This entitlement grants the ability to create, modify, and delete database objects, manage user permissions, and configure system settings.",
    lastlogindate: "2024-01-15",
    businessService: "Production Database",
  },
  {
    entitlementName: "Backup Operator",
    entitlementDescription: "Access to perform database backup operations.",
    lastlogindate: "2024-01-14",
    businessService: "Production Database",
  },
  {
    entitlementName: "Read-Only Access",
    entitlementDescription:
      "Read-only access to API gateway services and configuration. This entitlement allows viewing of API endpoints, monitoring metrics, and accessing logs without the ability to modify settings.",
    lastlogindate: "2024-01-20",
    businessService: "API Gateway Service",
  },
  {
    entitlementName: "Monitoring Access",
    entitlementDescription:
      "Access to monitoring and alerting systems for infrastructure health checks.",
    lastlogindate: "2024-01-18",
    businessService: "Infrastructure Monitoring",
  },
  {
    entitlementName: "Alert Management",
    entitlementDescription: "Ability to manage and configure alerting rules.",
    lastlogindate: "2024-01-17",
    businessService: "Infrastructure Monitoring",
  },
];

function buildDefaultEntitlements(assignedTo: string): ServiceAccountEntitlement[] {
  const custodian = assignedTo || "N/A";
  return SERVICE_ACCOUNT_ENTITLEMENT_SEED.map((row) => ({
    ...row,
    userManager: custodian,
  }));
}

function buildServiceAccountRow(params: {
  accountName: string;
  assignedTo: string;
}) {
  const { accountName, assignedTo } = params;
  const entitlements = buildDefaultEntitlements(assignedTo);
  const primary = entitlements[0];
  return {
    accountName,
    entitlements,
    entitlementName: primary.entitlementName,
    entitlementDescription: primary.entitlementDescription,
    description:
      "Service account for production database management with elevated privileges. Used for automated maintenance tasks and system administration.",
    userManager: assignedTo || "N/A",
    lastlogindate: primary.lastlogindate,
    businessService: primary.businessService,
    backupOwner: "Jane Smith",
    environment: "Production",
    pamPolicy: "Standard PAM Policy",
    rotationPolicy: "30 Days Rotation",
    smeUser: "admin@company.com",
    continuousCompliance: true,
    reviewCycle: "Quarterly",
  };
}

export default function ServiceAccountOwnerInactiveReviewPage() {
  const searchParams = useSearchParams();
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const accountName =
    searchParams.get("details")?.trim() || "svc_api_hrsync";
  const assignedFromUrl =
    searchParams.get("assignedTo")?.trim() || "Jessica Camacho";
  const [custodianOverride, setCustodianOverride] = useState<string | null>(null);
  const effectiveAssignedTo = custodianOverride ?? assignedFromUrl;

  useEffect(() => {
    setCustodianOverride(null);
  }, [accountName, assignedFromUrl]);

  const rowData = useMemo(
    () => [buildServiceAccountRow({ accountName, assignedTo: effectiveAssignedTo })],
    [accountName, effectiveAssignedTo]
  );

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rowData.slice(start, start + pageSize);
  }, [rowData, currentPage, pageSize]);

  const totalItems = rowData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setMounted(true);
  }, []);

  const openViewSidebar = useCallback(
    (row: Record<string, unknown>) => {
      const InfoSidebar = () => {
        const [sectionsOpen, setSectionsOpen] = useState({ general: true });
        const scrollRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
          if (scrollRef.current && !document.getElementById("cc-sa-sidebar-scroll-hide")) {
            const style = document.createElement("style");
            style.id = "cc-sa-sidebar-scroll-hide";
            style.textContent = `.cc-sa-sidebar-scroll::-webkit-scrollbar { display: none; }`;
            document.head.appendChild(style);
          }
        }, []);

        return (
          <div className="flex flex-col h-full">
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto cc-sa-sidebar-scroll"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold">Service Account Details</h2>
                <div className="mt-2">
                  <span className="text-xs uppercase text-gray-500">Account:</span>
                  <div className="text-md font-medium break-words">
                    {String(row.accountName ?? "-")}
                  </div>
                </div>
                {Array.isArray(row.entitlements) &&
                (row.entitlements as unknown[]).length > 0 ? (
                  <div className="mt-2">
                    <span className="text-xs uppercase text-gray-500">
                      Entitlements ({(row.entitlements as unknown[]).length})
                    </span>
                    <ul className="mt-2 space-y-3 list-none">
                      {(row.entitlements as ServiceAccountEntitlement[]).map(
                        (ent, idx) => (
                          <li
                            key={`${ent.entitlementName}-${idx}`}
                            className="border border-gray-200 rounded-md p-2 bg-white min-w-0"
                          >
                            <div className="text-md font-medium break-words">
                              {ent.entitlementName}
                            </div>
                            <p className="text-sm text-gray-700 break-words whitespace-normal mt-1">
                              {ent.entitlementDescription}
                            </p>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ) : (
                  <>
                    <div className="mt-2">
                      <span className="text-xs uppercase text-gray-500">Entitlement:</span>
                      <div className="text-md font-medium break-words">
                        {String(row.entitlementName ?? "-")}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs uppercase text-gray-500">Description:</span>
                      <p className="text-sm text-gray-700 break-words whitespace-normal">
                        {String(
                          row.entitlementDescription ||
                            row.description ||
                            "-"
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                    onClick={() =>
                      setSectionsOpen((s) => ({ ...s, general: !s.general }))
                    }
                  >
                    <span>General</span>
                    {sectionsOpen.general ? (
                      <ChevronDown size={20} />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </button>
                  {sectionsOpen.general && (
                    <div className="p-4 space-y-4">
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Custodian
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.userManager || row.custodian || "N/A")}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Last Login
                          </label>
                          <div className="text-sm text-gray-900 mt-1">
                            {row.lastlogindate
                              ? formatDateMMDDYY(String(row.lastlogindate))
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Business Service
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(
                              row.businessService ||
                                row.applicationName ||
                                row.businessUnit ||
                                "N/A"
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Environment
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.environment || "N/A")}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Backup Owner
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.backupOwner || "N/A")}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            SME User
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.smeUser || "N/A")}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            PAM Policy
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.pamPolicy || "N/A")}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Rotation Policy
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.rotationPolicy || "N/A")}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Continuous Compliance
                          </label>
                          <div className="text-sm text-gray-900 mt-1">
                            {row.continuousCompliance === true ||
                            row.continuousCompliance === "true"
                              ? "Yes"
                              : "No"}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs uppercase text-gray-500 font-medium">
                            Review Cycle
                          </label>
                          <div className="text-sm text-gray-900 mt-1 break-words">
                            {String(row.reviewCycle || "N/A")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      };

      openSidebar(<InfoSidebar />, { widthPx: 500, title: "Service account" });
    },
    [openSidebar]
  );

  const openReassignSidebar = useCallback(
    (row: Record<string, unknown>) => {
      const resolveOwnerLabel = (owner: Record<string, unknown>) => {
        const fn = String(owner.firstname ?? "").trim();
        const ln = String(owner.lastname ?? "").trim();
        const full = [fn, ln].filter(Boolean).join(" ").trim();
        if (full) return full;
        const u = String(owner.username ?? "").trim();
        if (u) return u;
        const em = String(owner.email ?? "").trim();
        return em || "Unknown";
      };

      const ReassignPanel = () => {
        const [search, setSearch] = useState("");
        const [results, setResults] = useState<Record<string, unknown>[]>([]);
        const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        useEffect(() => {
          return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
          };
        }, []);

        useEffect(() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          const q = search.trim();
          if (q.length < 2) {
            setResults([]);
            setError(null);
            setLoading(false);
            return;
          }
          setLoading(true);
          setError(null);
          debounceRef.current = setTimeout(async () => {
            try {
              const query = `SELECT * FROM usr WHERE username ILIKE ? OR email::text ILIKE ? ORDER BY username ASC LIMIT 25`;
              const response = await executeQuery<{ resultSet?: unknown[] }>(query, [
                `%${q}%`,
                `%${q}%`,
              ]);
              let rows: Record<string, unknown>[] = [];
              if (response?.resultSet && Array.isArray(response.resultSet)) {
                rows = response.resultSet.map((user: Record<string, unknown>) => {
                  let emailValue = "";
                  const em = user.email;
                  if (typeof em === "string") emailValue = em;
                  else if (em && typeof em === "object" && "work" in (em as object))
                    emailValue = String((em as { work?: string }).work ?? "");
                  else if (Array.isArray(em) && em.length > 0) {
                    const primary =
                      (em as { primary?: boolean; value?: string }[]).find((e) => e.primary) ||
                      (em as { value?: string }[])[0];
                    emailValue = primary?.value ?? "";
                  }
                  const internalId =
                    user.userid ?? user.id ?? user.userUniqueID ?? "";
                  return {
                    ...user,
                    userid: internalId,
                    username: user.username ?? "",
                    email: emailValue,
                  };
                });
              }
              setResults(rows);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Search failed");
              setResults([]);
            } finally {
              setLoading(false);
            }
          }, 300);
        }, [search]);

        return (
          <div className="flex flex-col h-full">
            <p className="text-sm text-gray-600 mb-3">
              Reassign custodian for{" "}
              <span className="font-semibold text-gray-900">
                {String(row.accountName ?? "")}
              </span>{" "}
              while the current owner is inactive.
            </p>
            <label className="text-xs font-medium text-gray-700">Search new owner</label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              placeholder="Name or email"
              className="mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
              autoComplete="off"
            />
            {search.trim().length >= 2 && (
              <div className="mt-2 max-h-36 overflow-auto border border-gray-200 rounded-md p-2 text-sm bg-gray-50">
                {loading ? (
                  <p className="text-gray-500 text-center py-2">Searching…</p>
                ) : error ? (
                  <p className="text-red-600 text-xs">{error}</p>
                ) : results.length === 0 ? (
                  <p className="text-gray-500 italic">No users found.</p>
                ) : (
                  <ul className="space-y-1">
                    {results.map((u, idx) => {
                      const label =
                        resolveOwnerLabel(u) +
                        (String(u.email || "").trim() ? ` · ${String(u.email)}` : "");
                      const key = String(u.userid ?? u.username ?? idx);
                      const isSel =
                        !!selected &&
                        String(selected.userid ?? "") === String(u.userid ?? "") &&
                        String(selected.username ?? "") === String(u.username ?? "");
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className={`w-full text-left px-2 py-1.5 rounded border text-xs ${
                              isSel
                                ? "bg-blue-100 border-blue-300"
                                : "border-transparent hover:bg-gray-100"
                            }`}
                            onClick={() => setSelected(u)}
                          >
                            {label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => closeSidebar()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  setCustodianOverride(resolveOwnerLabel(selected));
                  closeSidebar();
                }}
              >
                Reassign
              </button>
            </div>
          </div>
        );
      };
      openSidebar(<ReassignPanel />, { widthPx: 420, title: "Reassign owner" });
    },
    [openSidebar, closeSidebar]
  );

  const entitlementsColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "entitlementName",
        headerName: "Entitlement",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || "-"}</span>
          </div>
        ),
      },
      {
        field: "entitlementDescription",
        headerName: "Description",
        flex: 3,
        wrapText: true,
        autoHeight: true,
        cellClass: "whitespace-normal",
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0 min-w-0 py-1">
            <span className="text-sm text-gray-700 break-words whitespace-normal leading-snug">
              {params.value || params.data?.description || "-"}
            </span>
          </div>
        ),
      },
      {
        field: "lastlogindate",
        headerName: "Last Login",
        flex: 1.5,
        valueFormatter: (params: ICellRendererParams) =>
          params.value ? formatDateMMDDYY(params.value) : "-",
      },
      {
        field: "businessService",
        headerName: "Business Service",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">
              {params.value || params.data?.applicationName || params.data?.businessUnit || "-"}
            </span>
          </div>
        ),
      },
      {
        field: "userManager",
        headerName: "Custodian",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">
              {params.value || params.data?.custodian || "-"}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const detailCellRendererParams = useMemo(
    () => ({
      detailGridOptions: {
        columnDefs: entitlementsColumnDefs,
        defaultColDef: {
          sortable: true,
          filter: true,
          resizable: true,
          flex: 1,
          wrapText: true,
          autoHeight: true,
        },
        // Normal layout inside a fixed-height detail row so the nested grid scrolls when content is tall.
        headerHeight: 40,
      },
      getDetailRowData: (params: {
        data: Record<string, unknown>;
        successCallback: (rows: unknown[]) => void;
      }) => {
        const serviceAccount = params.data;
        if (
          Array.isArray(serviceAccount.entitlements) &&
          (serviceAccount.entitlements as unknown[]).length > 0
        ) {
          params.successCallback(serviceAccount.entitlements as unknown[]);
          return;
        }
        const entitlements: Record<string, unknown>[] = [];
        if (serviceAccount.entitlementName) {
          entitlements.push({
            entitlementName: serviceAccount.entitlementName,
            entitlementDescription:
              serviceAccount.entitlementDescription || serviceAccount.description || "",
            lastlogindate: serviceAccount.lastlogindate,
            businessService:
              serviceAccount.businessService ||
              serviceAccount.applicationName ||
              serviceAccount.businessUnit,
            userManager: serviceAccount.userManager || serviceAccount.custodian,
          });
        }
        params.successCallback(entitlements);
      },
    }),
    [entitlementsColumnDefs]
  );

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "accountName",
        headerName: "Account",
        flex: 2,
        cellRenderer: "agGroupCellRenderer",
        cellRendererParams: {
          innerRenderer: (params: ICellRendererParams) => (
            <div className="flex flex-col gap-0">
              <span className="text-md text-gray-800">{params.value || "-"}</span>
            </div>
          ),
        },
      },
      {
        field: "userManager",
        headerName: "Custodian",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">
              {params.value || params.data?.custodian || "-"}
            </span>
          </div>
        ),
      },
      {
        field: "lastlogindate",
        headerName: "Last Login",
        enableRowGroup: true,
        flex: 1.5,
        valueFormatter: (params: ICellRendererParams) =>
          params.value ? formatDateMMDDYY(params.value) : "-",
      },
      {
        field: "businessService",
        headerName: "Business Service",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">
              {params.value || params.data?.applicationName || params.data?.businessUnit || "-"}
            </span>
          </div>
        ),
      },
      {
        field: "__action__",
        headerName: "Action",
        width: 150,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div
            className="flex items-center gap-2 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="View"
              aria-label="View account details"
              onClick={() => openViewSidebar((params.data || {}) as Record<string, unknown>)}
            >
              <ArrowRight color="#55544d" size={20} className="transform scale-[0.9]" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-purple-50 text-purple-700"
              title="Reassign"
              aria-label="Reassign owner"
              onClick={() =>
                openReassignSidebar((params.data || {}) as Record<string, unknown>)
              }
            >
              <UserRoundCheck size={20} strokeWidth={1.5} />
            </button>
          </div>
        ),
      },
    ],
    [openViewSidebar, openReassignSidebar]
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
    }),
    []
  );

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-5 px-0 md:px-0">
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        {mounted && (
          <div className="w-full min-h-[600px]">
            <AgGridReact
              theme={themeQuartz}
              rowData={paginatedData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              masterDetail
              detailCellRendererParams={detailCellRendererParams}
              detailRowHeight={560}
              domLayout="autoHeight"
            />
          </div>
        )}
        <div className="flex justify-center mt-3">
          <CustomPagination
            totalItems={totalItems}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(n) => {
              if (n === "all") {
                setPageSize(totalItems || 10);
              } else {
                setPageSize(n);
              }
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>
    </div>
  );
}
