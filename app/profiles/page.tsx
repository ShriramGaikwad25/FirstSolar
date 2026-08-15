"use client";
import React, { useMemo, useState, useEffect } from "react";
import { themeQuartz } from "ag-grid-community";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import { ColDef, ICellRendererParams, IDetailCellRendererParams } from "ag-grid-enterprise";
import ActionButtons from "@/components/agTable/ActionButtons";
import CustomPagination from "@/components/agTable/CustomPagination";
import Accordion from "@/components/Accordion";
import ChartComponent from "@/components/ChartComponent";
import { formatDateMMDDYY } from "../access-review/page";
import { apiRequestWithAuth } from "@/lib/auth";
import { useLoading } from "@/contexts/LoadingContext";
import HorizontalTabs from "@/components/HorizontalTabs";
import managerClustersJson from "@/public/managerClusters.json";
import { ChevronRight, CircleCheck, CircleX } from "lucide-react";

/** Quartz default selected row uses accent tint; force neutral so rows never stay “visited blue”. */
const clusterGridTheme = themeQuartz.withParams({
  selectedRowBackgroundColor: "#ffffff",
  rangeSelectionBackgroundColor: "transparent",
  rangeSelectionBorderColor: "transparent",
});

// Custom detail cell renderer for profileanalytics
const ProfileAnalyticsDetailRenderer = (params: IDetailCellRendererParams) => {
  const profileData = params.data?.profileData;
  const profileanalytics = profileData?.profileanalytics;

  if (!profileanalytics) {
    return (
      <div className="p-4 bg-gray-50">
        <p className="text-gray-600">No profile analytics data available</p>
      </div>
    );
  }

  const { entitlementCounts } = profileanalytics;

  // Flatten entitlements with application names for table display
  const tableData = entitlementCounts?.flatMap((app: any) =>
    (app.entitlements || []).map((entitlement: any) => ({
      applicationName: app.applicationname || "N/A",
      entitlementName: entitlement.name || "N/A",
      userCount: entitlement.userCount ?? 0,
    }))
  ) || [];

  return (
    <div className="w-full profile-detail-table" style={{ margin: 0, padding: '8px', paddingBottom: '16px' }}>
      {tableData.length > 0 ? (
        <div className="bg-white border border-gray-200 overflow-hidden w-full rounded-md">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Application Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Entitlement Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">User Count</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row: any, index: number) => (
                <tr 
                  key={index} 
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
                >
                  <td className="px-4 py-2 text-sm text-gray-700">{row.applicationName}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.entitlementName}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-600">{row.userCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-600 p-2">No entitlement data available</p>
      )}
    </div>
  );
};

type ClusterGridRow = {
  rowId: string;
  clusterOrdinal: number;
  managerName: string;
  managerId: string;
  groupSize: number;
  total_entitlements_in_cluster: number | null;
  sharedEntitlementFootprint: number | string;
  densityScore: number | null;
  nonClusterUsernames: string[];
  clusterUsernames: string[];
  sharedEntitlements: { entitlement_name?: string; application?: string }[];
  clusterTitle: string;
};

function flattenManagerClustersToRows(raw: any[]): Omit<ClusterGridRow, "clusterTitle">[] {
  let ordinal = 0;
  const out: Omit<ClusterGridRow, "clusterTitle">[] = [];
  for (const m of raw) {
    const managerName = m.manager_name ?? "—";
    const managerId = m.manager_id ?? "";
    const nonCluster = Array.isArray(m.non_cluster_users) ? m.non_cluster_users : [];
    const groups = Array.isArray(m.groups) ? m.groups : [];
    for (const g of groups) {
      ordinal += 1;
      const analytics =
        Array.isArray(g.analytics) && g.analytics.length > 0 ? g.analytics[0] : {};
      const userList = Array.isArray(g.users)
        ? g.users.map((u: any) => u.username).filter(Boolean)
        : Array.isArray(m.cluster_users)
          ? [...m.cluster_users]
          : [];
      out.push({
        rowId: String(g.group_id ?? `${managerId}_${ordinal}`),
        clusterOrdinal: ordinal,
        managerName,
        managerId,
        groupSize: g.group_size ?? userList.length,
        total_entitlements_in_cluster:
          typeof analytics.total_entitlements_in_cluster === "number"
            ? analytics.total_entitlements_in_cluster
            : null,
        sharedEntitlementFootprint:
          analytics.shared_entitlement_footprint ?? "—",
        densityScore:
          typeof analytics.density_score === "number"
            ? analytics.density_score
            : null,
        nonClusterUsernames: nonCluster,
        clusterUsernames: userList,
        sharedEntitlements: Array.isArray(g.shared_entitlements)
          ? g.shared_entitlements
          : [],
      });
    }
  }
  return out;
}

const CLUSTER_USER_TAG_CLASS =
  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-800 border-slate-200";

type ClusterUsersStripRow = {
  rowKind: "usersStrip";
  rowId: string;
  clusterUsernames: string[];
  hasEntitlementsOpenBelow?: boolean;
};

type ClusterEntitlementsStripRow = {
  rowKind: "entitlementsStrip";
  rowId: string;
  sharedEntitlements: { entitlement_name?: string; application?: string }[];
  parentMainRowId: string;
};

function SharedEntitlementsTable({ rows }: { rows: any[] }) {
  if (!rows.length) {
    return (
      <div className="w-full px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t border-gray-100 box-border">
        No shared entitlements for this cluster.
      </div>
    );
  }
  return (
    <div className="w-full bg-transparent box-border overflow-visible" style={{ margin: 0, padding: "8px 16px 16px" }}>
      <div className="bg-white border border-gray-200 overflow-visible w-full rounded-md">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Application
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Entitlement
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, index: number) => (
              <tr
                key={index}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
              >
                <td className="px-4 py-2 text-sm text-gray-800">
                  {row.application ?? "—"}
                </td>
                <td className="px-4 py-2 text-sm text-gray-800">
                  {row.entitlement_name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function displayedGridColumnCount(api: ICellRendererParams["api"]): number {
  try {
    const a = api as {
      getDisplayedLeftColumns?: () => unknown[];
      getDisplayedCenterColumns?: () => unknown[];
      getDisplayedRightColumns?: () => unknown[];
    };
    const l = a.getDisplayedLeftColumns?.() ?? [];
    const c = a.getDisplayedCenterColumns?.() ?? [];
    const r = a.getDisplayedRightColumns?.() ?? [];
    const n = l.length + c.length + r.length;
    return n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

function ProfilesTab() {
  const [selectedProfile, setSelectedProfile] = useState<string>("Q1 Profiling");
  const [apiData, setApiData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const { showApiLoader, hideApiLoader } = useLoading();
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "profile",
        headerName: "Profile",
        flex: 5,
        minWidth: 200,
        cellRenderer: "agGroupCellRenderer",
      },
      { field: "users", headerName: "Users", flex: 2, minWidth: 96 },
      {
        field: "newGrants",
        headerName: "New Grants",
        type: "numberColumn",
        flex: 2,
        minWidth: 108,
      },
      {
        field: "activeGrants",
        headerName: "Active Grants",
        type: "numberColumn",
        flex: 2,
        minWidth: 118,
      },
      {
        field: "lastUpdated",
        headerName: "Last Updated",
        flex: 2,
        minWidth: 118,
        valueFormatter: (params) => formatDateMMDDYY(params.value),
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 220,
        flex: 3,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <ActionButtons api={params.api} selectedRows={[params.data]} />
          );
        },
      },
    ],
    []
  );
  //     mode: "multiRow",
  //   };
  // }, []);


  // Extract unique profile names for the dropdown
  const profileNames = useMemo(() => {
    // Only include Q1 Profiling in the dropdown
    return ["Q1 Profiling"];
  }, []);

  // Call API when Q1 Profiling is selected
  useEffect(() => {
    const fetchProfileData = async () => {
      if (selectedProfile === "Q1 Profiling") {
        try {
          showApiLoader("Loading profile data...");
          const profileName = encodeURIComponent("Q1 Profiling");
          const apiUrl = `https://preview.keyforge.ai/profiling/api/v1/ACMECOM/getProfileByname/${profileName}`;
          const response = await apiRequestWithAuth<any>(apiUrl);
          
          // Transform API response to match table structure
          // Handle both array and single object responses
          const responseArray = Array.isArray(response) ? response : (response ? [response] : []);
          const transformedData = responseArray.map((item: any) => {
            // Calculate total number of entitlements from entitlementCounts
            const totalEntitlements = item.profileanalytics?.entitlementCounts?.reduce((count: number, app: any) => {
              return count + (app.entitlements?.length || 0);
            }, 0) || 0;
            
            // Format profiledefinition for display
            const formatProfileDefinition = (profiledefinition: any) => {
              if (!profiledefinition) return item.nameofanalytics || item.profilename || "Q1 Profiling";
              if (typeof profiledefinition === 'string') return profiledefinition;
              // Convert object to readable string format (e.g., "location = ID")
              return Object.entries(profiledefinition)
                .map(([key, value]) => `${key} = ${value}`)
                .join(' & ');
            };
            
            // Format users as numOfUsers/totalUsers
            const numOfUsers = item.profileanalytics?.numOfUsers ?? 0;
            const totalUsers = item.profileanalytics?.totalUsers ?? 0;
            const usersDisplay = `${numOfUsers}/${totalUsers}`;
            
            return {
              profile: formatProfileDefinition(item.profiledefinition),
              users: usersDisplay,
              newGrants: 0, // Not available in API response
              activeGrants: totalEntitlements,
              lastUpdated: formatDateMMDDYY(item.createtime) || "",
              details: item.profiledescription || JSON.stringify(item.profileanalytics, null, 2),
              profileData: item, // Store full data for detail view
            };
          });
          
          setApiData(transformedData);
        } catch (error) {
          console.error("Error fetching profile data:", error);
          setApiData([]);
        } finally {
          hideApiLoader();
        }
      } else {
        setApiData([]);
      }
    };

    fetchProfileData();
  }, [selectedProfile, showApiLoader, hideApiLoader]);

  // Use only API data
  const filteredRowData = useMemo(() => {
    return apiData;
  }, [apiData]);

  const totalItems = filteredRowData.length;
  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  const paginatedRowData = useMemo(() => {
    if (pageSize === "all") return filteredRowData;
    const start = (currentPage - 1) * pageSize;
    return filteredRowData.slice(start, start + pageSize);
  }, [filteredRowData, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [apiData]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const defaultColDef = {
    sortable: true,
    filter: false,
    resizable: true,
  };

  return (
    <div className="ag-theme-alpine" style={{ width: "100%" }}>
      <div className="relative mb-4">
        <Accordion
          iconClass="absolute top-1 right-0 rounded-full text-white bg-purple-800"
          title="Expand/Collapse"
        >
          <ChartComponent />
        </Accordion>
      </div>
      <div className="mb-4">
        <label htmlFor="profile-name-select" className="block text-sm font-medium text-gray-700 mb-2">
          Profile Name
        </label>
        <select
          id="profile-name-select"
          value={selectedProfile}
          onChange={(e) => setSelectedProfile(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
        >
          {profileNames.map((profileName, index) => (
            <option key={index} value={profileName}>
              {profileName}
            </option>
          ))}
        </select>
      </div>
      <style>{`
        .ag-row-group-expanded,
        .expanded-row-highlight {
          background-color: #E5EEFC !important;
        }
        .ag-row-group-expanded:hover,
        .expanded-row-highlight:hover {
          background-color: #D0E0F5 !important;
        }
        .ag-row-group-expanded .ag-cell,
        .expanded-row-highlight .ag-cell {
          background-color: #E5EEFC !important;
        }
        .expanded-row-highlight.ag-row:hover {
          background-color: #D0E0F5 !important;
        }
      `}</style>
      <div className="mb-2">
        <CustomPagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100, "all"]}
        />
      </div>
      <div className="w-full">
        <AgGridReact
          theme={themeQuartz}
          rowData={paginatedRowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={false}
          domLayout="autoHeight"
          // rowSelection={rowSelection}
          masterDetail={true}
          detailCellRenderer={ProfileAnalyticsDetailRenderer}
          detailRowAutoHeight={true}
          getRowClass={(params) => {
            if (params.node.expanded) {
              return 'expanded-row-highlight';
            }
            return '';
          }}
        />
      </div>
      <div className="mt-2">
        <CustomPagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100, "all"]}
        />
      </div>
    </div>
  );
}

type ClusterGridContext = {
  openApproveCluster: (rowId: string, defaultName: string) => void;
  openNonClusterUsers: (names: string[]) => void;
  rejectCluster: (rowId: string) => void;
  expandedClusterMainIds: string[];
  toggleClusterTableExpand: (mainRowId: string) => void;
};

function ClusterTab() {
  const baseRows = useMemo(() => {
    const list = Array.isArray(managerClustersJson)
      ? managerClustersJson
      : [];
    return flattenManagerClustersToRows(list);
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [clusterDisplayNames, setClusterDisplayNames] = useState<Record<string, string>>({});
  const [rejectedRowIds, setRejectedRowIds] = useState<string[]>([]);
  const [nonClusterModalUsers, setNonClusterModalUsers] = useState<string[] | null>(null);
  const [approveModal, setApproveModal] = useState<{
    rowId: string;
    defaultName: string;
  } | null>(null);
  const [approveNameDraft, setApproveNameDraft] = useState("");
  const [expandedClusterMainIds, setExpandedClusterMainIds] = useState<string[]>([]);

  useEffect(() => {
    if (approveModal) setApproveNameDraft(approveModal.defaultName);
  }, [approveModal]);

  useEffect(() => {
    setExpandedClusterMainIds([]);
  }, [currentPage, pageSize]);

  const rows: ClusterGridRow[] = useMemo(() => {
    const rejected = new Set(rejectedRowIds);
    return baseRows
      .filter((r) => !rejected.has(r.rowId))
      .map((r) => {
        const defaultTitle = `Cluster ${r.clusterOrdinal}, Manager: ${r.managerName}`;
        return {
          ...r,
          clusterTitle: clusterDisplayNames[r.rowId] ?? defaultTitle,
        };
      });
  }, [baseRows, rejectedRowIds, clusterDisplayNames]);

  const gridContext = useMemo<ClusterGridContext>(
    () => ({
      openApproveCluster: (rowId, defaultName) =>
        setApproveModal({ rowId, defaultName }),
      openNonClusterUsers: (names) => setNonClusterModalUsers(names),
      rejectCluster: (rowId) => {
        setRejectedRowIds((prev) =>
          prev.includes(rowId) ? prev : [...prev, rowId]
        );
        setExpandedClusterMainIds((prev) => prev.filter((id) => id !== rowId));
      },
      expandedClusterMainIds,
      toggleClusterTableExpand: (mainRowId) => {
        setExpandedClusterMainIds((prev) =>
          prev.includes(mainRowId)
            ? prev.filter((id) => id !== mainRowId)
            : [...prev, mainRowId]
        );
      },
    }),
    [expandedClusterMainIds]
  );

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "clusterTitle",
        headerName: "Cluster",
        flex: 2.2,
        minWidth: 260,
        wrapText: true,
        autoHeight: true,
        colSpan: (params) => {
          const d = params.data as { rowKind?: string } | undefined;
          if (d?.rowKind === "usersStrip" || d?.rowKind === "entitlementsStrip") {
            const n = displayedGridColumnCount(params.api);
            return Math.max(n, 7);
          }
          return 1;
        },
        cellRenderer: (params: ICellRendererParams) => {
          const d = params.data as
            | ClusterGridRow
            | ClusterUsersStripRow
            | ClusterEntitlementsStripRow
            | undefined;
          if (!d) return null;
          if (d.rowKind === "usersStrip") {
            const users = d.clusterUsernames ?? [];
            if (users.length === 0) {
              return (
                <div className="w-full py-1 text-xs text-gray-500">
                  No users listed
                </div>
              );
            }
            return (
              <div className="w-full py-1.5">
                <div className="flex flex-wrap gap-1.5 w-full items-center">
                  {users.map((u: string, i: number) => (
                    <span key={`${u}-${i}`} className={CLUSTER_USER_TAG_CLASS}>
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          if (d.rowKind === "entitlementsStrip") {
            return <SharedEntitlementsTable rows={d.sharedEntitlements} />;
          }
          const main = d as ClusterGridRow;
          if (!main.clusterTitle) return null;
          const ctx = params.context as ClusterGridContext | undefined;
          const entCount = main.sharedEntitlements?.length ?? 0;
          const expandable = entCount > 0;
          const expanded =
            ctx?.expandedClusterMainIds.includes(main.rowId) ?? false;
          return (
            <div className="flex items-start gap-1 py-2 pr-2 leading-snug">
              {expandable ? (
                <button
                  type="button"
                  className="mt-0.5 p-0.5 rounded hover:bg-gray-200/80 text-gray-700 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx?.toggleClusterTableExpand(main.rowId);
                  }}
                  aria-expanded={expanded}
                  aria-label={
                    expanded
                      ? "Collapse shared entitlements"
                      : "Expand shared entitlements"
                  }
                >
                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
                    strokeWidth={2}
                  />
                </button>
              ) : (
                <span className="w-6 shrink-0" aria-hidden />
              )}
              <div className="text-sm font-semibold text-gray-900 min-w-0">
                {main.clusterTitle}
              </div>
            </div>
          );
        },
      },
      {
        field: "groupSize",
        headerName: "Users",
        type: "numberColumn",
        flex: 0.7,
        minWidth: 88,
      },
      {
        field: "total_entitlements_in_cluster",
        headerName: "Total Grants",
        type: "numberColumn",
        flex: 0.9,
        minWidth: 118,
        valueFormatter: (p) =>
          p.value == null || typeof p.value !== "number" ? "—" : String(p.value),
      },
      {
        field: "sharedEntitlementFootprint",
        headerName: "Shared Grants",
        flex: 0.9,
        minWidth: 124,
      },
      {
        field: "densityScore",
        headerName: "Cluster Density",
        flex: 0.95,
        minWidth: 130,
        valueFormatter: (p) => {
          const v = p.value;
          if (v == null || typeof v !== "number") return "—";
          const percent = v <= 1 ? v * 100 : v;
          return `${percent.toFixed(2)}%`;
        },
      },
      {
        field: "nonClusterUsernames",
        headerName: "Non Cluster Users",
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const names: string[] = params.data?.nonClusterUsernames ?? [];
          const ctx = params.context as ClusterGridContext | undefined;
          const n = names.length;
          const tagBase =
            "inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums border transition-colors";
          if (n === 0) {
            return (
              <span
                className={`${tagBase} bg-gray-100 text-gray-600 border-gray-200`}
              >
                0
              </span>
            );
          }
          return (
            <button
              type="button"
              className={`${tagBase} bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer`}
              onClick={() => ctx?.openNonClusterUsers(names)}
            >
              {n}
            </button>
          );
        },
      },
      {
        field: "rowId",
        headerName: "Actions",
        flex: 1.1,
        minWidth: 120,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const rowId = params.data?.rowId as string;
          const title = params.data?.clusterTitle as string;
          const ctx = params.context as ClusterGridContext | undefined;
          return (
            <div className="flex space-x-3 h-full items-center py-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx?.openApproveCluster(rowId, title);
                }}
                title="Approve"
                aria-label="Approve cluster"
                className="p-1 rounded flex items-center justify-center"
              >
                <div className="relative inline-flex items-center justify-center w-8 h-8">
                  <CircleCheck
                    className="cursor-pointer hover:opacity-80"
                    color="#1c821cff"
                    strokeWidth={1}
                    size={32}
                    fill="none"
                  />
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx?.rejectCluster(rowId);
                }}
                title="Reject"
                aria-label="Reject cluster"
                className="p-1 rounded flex items-center justify-center"
              >
                <div className="relative inline-flex items-center justify-center w-8 h-8">
                  <CircleX
                    className="cursor-pointer hover:opacity-80"
                    color="#FF2D55"
                    strokeWidth={1}
                    size={32}
                    fill="none"
                  />
                </div>
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  const defaultColDef = {
    sortable: false,
    filter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
  };

  const totalItems = rows.length;
  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  const paginatedClusterRows = useMemo(() => {
    if (pageSize === "all") return rows;
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const gridRowData = useMemo(() => {
    const expanded = new Set(expandedClusterMainIds);
    const out: (ClusterGridRow | ClusterUsersStripRow | ClusterEntitlementsStripRow)[] = [];
    for (const r of paginatedClusterRows) {
      const tableOpen =
        expanded.has(r.rowId) && (r.sharedEntitlements?.length ?? 0) > 0;
      out.push(r);
      out.push({
        rowKind: "usersStrip",
        rowId: `${r.rowId}__users-strip`,
        clusterUsernames: r.clusterUsernames,
        hasEntitlementsOpenBelow: tableOpen,
      });
      if (tableOpen) {
        out.push({
          rowKind: "entitlementsStrip",
          rowId: `${r.rowId}__entitlements-strip`,
          sharedEntitlements: r.sharedEntitlements,
          parentMainRowId: r.rowId,
        });
      }
    }
    return out;
  }, [paginatedClusterRows, expandedClusterMainIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [baseRows, rejectedRowIds]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const submitApprove = () => {
    if (!approveModal) return;
    const name = approveNameDraft.trim();
    if (name) {
      setClusterDisplayNames((prev) => ({
        ...prev,
        [approveModal.rowId]: name,
      }));
    }
    setApproveModal(null);
  };

  return (
    <div className="ag-theme-alpine w-full relative">
      {nonClusterModalUsers && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="non-cluster-modal-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h2
                id="non-cluster-modal-title"
                className="text-base font-semibold text-gray-900"
              >
                Non-cluster users ({nonClusterModalUsers.length})
              </h2>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800 text-lg leading-none px-2"
                onClick={() => setNonClusterModalUsers(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ul className="overflow-y-auto px-4 py-3 text-sm text-gray-800 space-y-1">
              {nonClusterModalUsers.map((u) => (
                <li key={u} className="border-b border-gray-100 last:border-0 py-1.5">
                  {u}
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800"
                onClick={() => setNonClusterModalUsers(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {approveModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-cluster-modal-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2
                id="approve-cluster-modal-title"
                className="text-base font-semibold text-gray-900"
              >
                Approve cluster
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Rename this cluster before submitting.
              </p>
            </div>
            <div className="px-4 py-4">
              <label
                htmlFor="cluster-rename-input"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Cluster name
              </label>
              <input
                id="cluster-rename-input"
                type="text"
                value={approveNameDraft}
                onChange={(e) => setApproveNameDraft(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setApproveModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={submitApprove}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-2">
        <CustomPagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100, "all"]}
        />
      </div>
      <div className="w-full profiles-cluster-grid ag-cluster-no-selection">
        <AgGridReact
          theme={clusterGridTheme}
          rowData={gridRowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={gridContext}
          pagination={false}
          domLayout="autoHeight"
          rowSelection={false}
          suppressRowClickSelection
          suppressCellFocus
          getRowId={(params) => String(params.data?.rowId ?? "")}
          onGridReady={(e) => {
            try {
              e.api.deselectAll();
            } catch {
              /* ignore */
            }
          }}
          onRowSelected={(e) => {
            if (e.node.isSelected()) {
              try {
                e.node.setSelected(false, false, true);
              } catch {
                /* ignore */
              }
            }
          }}
          onFirstDataRendered={(e) => {
            try {
              e.api.resetRowHeights();
              e.api.deselectAll();
            } catch {
              /* ignore */
            }
          }}
          onRowDataUpdated={(e) => {
            window.setTimeout(() => {
              try {
                e.api.resetRowHeights();
              } catch {
                /* ignore */
              }
            }, 0);
          }}
          getRowClass={(params) => {
            const d = params.data as {
              rowKind?: string;
              clusterTitle?: string;
              rowId?: string;
            } | undefined;
            if (d?.rowKind === "usersStrip") {
              let c = "cluster-users-strip-row";
              if (d.hasEntitlementsOpenBelow) {
                c += " cluster-users-strip-before-entitlements";
              }
              return c;
            }
            if (d?.rowKind === "entitlementsStrip") {
              return "cluster-entitlements-strip-row";
            }
            if (d?.clusterTitle !== undefined) {
              return "cluster-main-metric-row";
            }
            return "";
          }}
        />
      </div>
      <style>{`
        .ag-cluster-no-selection {
          --ag-selected-row-background-color: #ffffff;
          --ag-range-selection-background-color: transparent;
          --ag-range-selection-border-color: transparent;
        }
        .profiles-cluster-grid .ag-row.ag-row-selected,
        .profiles-cluster-grid .ag-row.ag-row-selected .ag-cell {
          background-color: var(--ag-background-color, #ffffff) !important;
          background-image: none !important;
        }
        .profiles-cluster-grid .ag-row-focus .ag-cell,
        .profiles-cluster-grid .ag-row-focus:not(.ag-row-selected) .ag-cell {
          outline: none !important;
        }
        .profiles-cluster-grid .ag-cell-range-selected,
        .profiles-cluster-grid .ag-cell-range-single-cell,
        .profiles-cluster-grid .ag-cell-range-selected-1,
        .profiles-cluster-grid .ag-cell-range-selected-2,
        .profiles-cluster-grid .ag-cell-range-selected-3,
        .profiles-cluster-grid .ag-cell-range-selected-4 {
          background-color: transparent !important;
        }
        /* Metric + user tags + optional entitlements table = one block */
        .cluster-main-metric-row .ag-cell {
          border-bottom-color: transparent !important;
        }
        .cluster-users-strip-row .ag-cell {
          border-top: none !important;
          background-color: var(--ag-background-color, #fff) !important;
        }
        .cluster-users-strip-before-entitlements .ag-cell {
          border-bottom-color: transparent !important;
        }
        .cluster-users-strip-row:not(.cluster-users-strip-before-entitlements) .ag-cell {
          border-bottom: 1px solid var(--ag-border-color, #dde2eb) !important;
        }
        .cluster-entitlements-strip-row .ag-cell {
          border-top: none !important;
          background-color: var(--ag-background-color, #fff) !important;
        }
        .cluster-entitlements-strip-row .ag-cell {
          border-bottom: 1px solid var(--ag-border-color, #dde2eb) !important;
        }
        .profiles-cluster-grid .cluster-main-metric-row:hover .ag-cell,
        .profiles-cluster-grid .cluster-main-metric-row:hover + .cluster-users-strip-row .ag-cell,
        .profiles-cluster-grid .cluster-main-metric-row:hover + .cluster-users-strip-row + .cluster-entitlements-strip-row .ag-cell {
          background-color: var(--ag-row-hover-color, #f9fafb) !important;
        }
        .cluster-users-strip-row:hover .ag-cell {
          background-color: var(--ag-row-hover-color, #f9fafb) !important;
        }
        .cluster-users-strip-row:hover + .cluster-entitlements-strip-row .ag-cell {
          background-color: var(--ag-row-hover-color, #f9fafb) !important;
        }
        .cluster-entitlements-strip-row:hover .ag-cell {
          background-color: var(--ag-row-hover-color, #f9fafb) !important;
        }
        .cluster-users-strip-row .ag-cell.ag-cell-focus,
        .cluster-entitlements-strip-row .ag-cell.ag-cell-focus {
          border-color: transparent !important;
        }
      `}</style>
      <div className="mt-2">
        <CustomPagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100, "all"]}
        />
      </div>
    </div>
  );
}

export default function Page() {
  const tabs = [
    { label: "Profiles", component: ProfilesTab },
    { label: "Cluster", component: ClusterTab },
  ];

  return <HorizontalTabs tabs={tabs} defaultIndex={0} />;
}
