import React, { useState, useEffect, useMemo, useRef } from "react";
import { formatDateMMDDYYSlashes } from "../utils/utils";
import ProgressDonutChart from "./ProgressDonutChart";
import ActionButtons from "./agTable/ActionButtons";
import AgGridReact from "./ClientOnlyAgGrid";
import type { ColDef } from "ag-grid-community";
import { executeQuery } from "@/lib/api";
import CustomPagination from "./agTable/CustomPagination";

interface DataItem {
  label: string;
  value: number;
  color?: string;
}

function firstNonEmptyString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function getInsightUserContext(insight: unknown): Record<string, unknown> | null {
  if (!insight || typeof insight !== "object") return null;
  const uc = (insight as Record<string, unknown>).user_context;
  if (uc && typeof uc === "object" && !Array.isArray(uc)) return uc as Record<string, unknown>;
  return null;
}

/** e.g. kf_insights payload may have `entitlement: { entitlement_name, application }` */
function getInsightEntitlementBlock(insight: unknown): Record<string, unknown> | null {
  if (!insight || typeof insight !== "object") return null;
  const e = (insight as Record<string, unknown>).entitlement;
  if (e && typeof e === "object" && !Array.isArray(e)) return e as Record<string, unknown>;
  return null;
}

function extractSpeedPeerInsightFields(
  insight: unknown
): { peerEntitlement: string; peerApplication: string } {
  const uc = getInsightUserContext(insight);
  const ins = insight && typeof insight === "object" ? (insight as Record<string, unknown>) : null;
  const entBlock = getInsightEntitlementBlock(insight);

  const entitlement = firstNonEmptyString(
    entBlock?.entitlement_name,
    entBlock?.entitlementName,
    uc?.entitlement_name,
    uc?.entitlementName,
    uc?.entitlement_displayname,
    uc?.entitlement_display_name,
    typeof (uc as any)?.entitlement === "string" ? (uc as any).entitlement : undefined,
    ins?.entitlement_name,
    (ins as any)?.entitlementName
  );

  const application = firstNonEmptyString(
    entBlock?.application,
    entBlock?.application_name,
    entBlock?.applicationName,
    uc?.application_name,
    uc?.applicationName,
    uc?.application_displayname,
    typeof (uc as any)?.application === "string" ? (uc as any).application : undefined,
    ins?.application_name,
    (ins as any)?.applicationName,
    typeof (ins as any)?.application === "string" ? (ins as any).application : undefined
  );

  return {
    peerEntitlement: entitlement || "—",
    peerApplication: application || "—",
  };
}

function normalizeSpeedPeerReviewRows(response: unknown): any[] {
  if (!response || typeof response !== "object") return [];
  const o = response as Record<string, unknown>;

  let payload: unknown = undefined;

  // Common shape: { resultSet: [ { result: {...} } ] }
  if (Array.isArray(o.resultSet) && o.resultSet.length > 0) {
    const row0 = o.resultSet[0] as Record<string, unknown>;
    payload = row0?.result ?? row0;
  } else if (Array.isArray(o.rows) && o.rows.length > 0) {
    // Alternate shape: { rows: [ {...} ] }
    const row0 = o.rows[0] as Record<string, unknown>;
    payload = row0?.result ?? row0;
  } else if (o.resultSet && typeof o.resultSet === "object") {
    // Some backends may return resultSet as an object directly
    payload = o.resultSet;
  } else if (o.result != null) {
    payload = o.result;
  } else {
    return [];
  }

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return [];
    }
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const inner = payload as Record<string, unknown>;
  // Some payloads wrap the user->insights map under `resultSet`,
  // others return the map directly.
  const mapCandidate = (inner as any).resultSet ?? inner;
  if (!mapCandidate || typeof mapCandidate !== "object" || Array.isArray(mapCandidate)) return [];

  const rows: any[] = [];
  for (const [userKey, items] of Object.entries(mapCandidate as Record<string, unknown>)) {
    const arr = Array.isArray(items) ? items : [];
    arr.forEach((insight, idx) => {
      const { peerEntitlement, peerApplication } = extractSpeedPeerInsightFields(insight);
      rows.push({
        user_displayname: userKey,
        insight_index: idx,
        insight,
        peerEntitlement,
        peerApplication,
      });
    });
  }

  return rows;
}

/** AppOwner Speed card Review: grouped insights by user_displayname. */
const APP_OWNER_SPEED_PEER_REVIEW_QUERY =
  "SELECT jsonb_build_object('resultSet', COALESCE(jsonb_object_agg(user_displayname, user_items), '{}'::jsonb)) AS result FROM ( SELECT COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') AS user_displayname, jsonb_agg(insight) AS user_items FROM app_owner_taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight WHERE insight -> 'latest_decision' ->> 'reviewer' = ? AND EXISTS ( SELECT 1 FROM jsonb_array_elements(COALESCE(insight -> 'peer_analysis','[]'::jsonb)) AS pa WHERE (pa ->> 'percentage') ~ '^\\d+$' AND (pa ->> 'percentage')::int > ? ) GROUP BY COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') ORDER BY user_displayname LIMIT ? OFFSET ? ) s";

const APP_OWNER_SPEED_PEER_REVIEW_PARAMETERS: [string, number, number, number] = [
  "Jessica Camacho",
  70,
  50,
  0,
];

/** AppOwner Low Risk card Review: grouped insights by user_displayname (risk level filtered). */
const APP_OWNER_LOW_RISK_REVIEW_QUERY =
  "SELECT jsonb_build_object('resultSet', COALESCE(jsonb_object_agg(user_displayname, user_items), '{}'::jsonb)) AS result FROM ( SELECT COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') AS user_displayname, jsonb_agg(insight) AS user_items FROM app_owner_taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight WHERE insight -> 'risk_assessment' -> 'details' ->> 'entitlement_risk_level' = ? AND insight -> 'latest_decision' ->> 'reviewer' = ? GROUP BY COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') ORDER BY user_displayname LIMIT ? OFFSET ? ) s";

const APP_OWNER_LOW_RISK_REVIEW_PARAMETERS: [string, string, number, number] = [
  "Low",
  "Jessica Camacho",
  50,
  0,
];

interface ChartAppOwnerComponentProps {
  rowData?: any[];
  onFilterChange?: (filter: string) => void;
  // When a filter is applied in the parent, pass it back so we can show the total next to the clicked item
  activeFilter?: string;
  activeCount?: number;
  analyticsData?: any;
  analyticsLoading?: boolean;
  certificationId?: string;
  // For Guided Path popup: reuse exact grid from AppOwner table
  entitlementsData?: any[];
  entitlementsColumnDefs?: ColDef[];
  entitlementsDefaultColDef?: ColDef;
  entitlementsAutoGroupColumnDef?: ColDef;
}

const ChartAppOwnerComponent: React.FC<ChartAppOwnerComponentProps> = ({
  rowData = [],
  onFilterChange,
  activeFilter,
  activeCount,
  analyticsData,
  analyticsLoading = false,
  certificationId,
  entitlementsData,
  entitlementsColumnDefs,
  entitlementsDefaultColDef,
  entitlementsAutoGroupColumnDef,
}) => {
  // AI Assist - Quick Wins Speed card %: ratio of peer matches above threshold
  const APP_OWNER_SPEED_QUICK_WIN_PERCENT_QUERY =
    "SELECT SUM(CASE WHEN (pa ->> 'percentage') ~ '^\\d+$' AND (pa ->> 'percentage')::int > ? THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS percentage FROM app_owner_taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight, jsonb_array_elements(COALESCE(insight -> 'peer_analysis','[]'::jsonb)) AS pa WHERE insight -> 'latest_decision' ->> 'reviewer' = ? LIMIT ? OFFSET ?";

  const [speedQuickWinPercent, setSpeedQuickWinPercent] = useState<number | null>(null);
  const [loadingSpeedQuickWin, setLoadingSpeedQuickWin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSpeedQuickWinPercent = async () => {
      setLoadingSpeedQuickWin(true);
      try {
        const response = await executeQuery<{ resultSet?: Array<{ percentage?: number | string | null }> }>(
          APP_OWNER_SPEED_QUICK_WIN_PERCENT_QUERY,
          [70, "Jessica Camacho", 50, 0]
        );
        const raw = response?.resultSet?.[0]?.percentage;
        if (cancelled) return;
        if (raw === null || raw === undefined) {
          setSpeedQuickWinPercent(null);
          return;
        }
        const num = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        if (!Number.isFinite(num)) {
          setSpeedQuickWinPercent(null);
          return;
        }
        // Query already returns a percentage-like number (e.g. 0.936 => show 0.93%).
        setSpeedQuickWinPercent(Math.floor(num * 100) / 100);
      } catch (e) {
        console.error("Error fetching AppOwner AI Quick Win Speed percentage:", e);
        if (!cancelled) setSpeedQuickWinPercent(null);
      } finally {
        if (!cancelled) setLoadingSpeedQuickWin(false);
      }
    };

    loadSpeedQuickWinPercent();
    return () => {
      cancelled = true;
    };
  }, []);

  // AI Assist - Quick Wins Low Risk card %: ratio of kf_insights rows with entitlement_risk_level = Low
  const APP_OWNER_LOW_RISK_QUICK_WIN_PERCENT_QUERY =
    "SELECT SUM(CASE WHEN insight -> 'risk_assessment' -> 'details' ->> 'entitlement_risk_level' = ? THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS percentage FROM app_owner_taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight WHERE insight -> 'latest_decision' ->> 'reviewer' = ? LIMIT ? OFFSET ?";

  const [lowRiskQuickWinPercent, setLowRiskQuickWinPercent] = useState<number | null>(null);
  const [loadingLowRiskQuickWin, setLoadingLowRiskQuickWin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadLowRiskQuickWinPercent = async () => {
      setLoadingLowRiskQuickWin(true);
      try {
        const response = await executeQuery<{
          resultSet?: Array<{ percentage?: number | string | null }>;
        }>(APP_OWNER_LOW_RISK_QUICK_WIN_PERCENT_QUERY, ["Low", "Jessica Camacho", 50, 0]);

        const raw = response?.resultSet?.[0]?.percentage;
        if (cancelled) return;
        if (raw === null || raw === undefined) {
          setLowRiskQuickWinPercent(null);
          return;
        }

        const num = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        if (!Number.isFinite(num)) {
          setLowRiskQuickWinPercent(null);
          return;
        }

        // API returns ratio-like float (e.g. 0.936...), and UI expects 0.xx displayed as "%".
        setLowRiskQuickWinPercent(Math.floor(num * 100) / 100);
      } catch (e) {
        console.error("Error fetching AppOwner AI Quick Win Low Risk percentage:", e);
        if (!cancelled) setLowRiskQuickWinPercent(null);
      } finally {
        if (!cancelled) setLoadingLowRiskQuickWin(false);
      }
    };

    loadLowRiskQuickWinPercent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Colors tuned to match the screenshot
  const allData: DataItem[] = [
    { label: "Elevated Accounts", value: 0, color: "#6EC6FF" },
    { label: "Orphan Accounts", value: 0, color: "#B3D9FF" },
    { label: "Terminated User Accounts", value: 0, color: "#D1D5DB" },
    { label: "Dormant Accounts", value: 0, color: "#B3D9FF" },
    { label: "New Access", value: 0, color: "#B3D9FF" },
    { label: "Over Privileged Users", value: 0, color: "#B3D9FF" },
    { label: "Compliance Violations", value: 0, color: "#6EC6FF" },
  ];

  // Mapping between filter labels and API filter values
  const filterMapping: { [key: string]: string } = {
    "Elevated Accounts": "iselevated eq Y",
    "Orphan Accounts": "isorphan eq Y",
    "Terminated User Accounts": "isterminated eq Y",
    "Dormant Accounts": "isdormant eq Y",
    "New Access": "isnewaccess eq Y",
    "Over Privileged Users": "isoverprivileged eq Y",
    "Compliance Violations": "iscomplianceviolation eq Y",
  };

  // Mapping between filter labels and analytics data fields
  const analyticsMapping: { [key: string]: string } = {
    "Elevated Accounts": "highriskaccount_count",
    "Orphan Accounts": "orphan_count",
    "Terminated User Accounts": "inactiveaccount_count",
    "Dormant Accounts": "dormant_count",
    "New Access": "newaccess_count",
    "Over Privileged Users": "highriskentitlement_count",
    "Compliance Violations": "violations_count",
  };

  const leftColumnFilters = allData.slice(0, 4);
  const rightColumnFilters = allData.slice(4);

  // Track selection for left and right columns separately
  const [selected, setSelected] = useState<{ [key: string]: number | null }>({});

  // Track which Guided Path card is hovered for flip animation
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  
  // State for localStorage data to avoid SSR issues
  const [localStorageData, setLocalStorageData] = useState<{
    selectedCampaignSummary: any;
    sharedRowData: any;
  } | null>(null);

  // Safely access localStorage only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const selectedCampaignSummary = localStorage.getItem("selectedCampaignSummary");
        const sharedRowData = localStorage.getItem("sharedRowData");
        
        setLocalStorageData({
          selectedCampaignSummary: selectedCampaignSummary ? JSON.parse(selectedCampaignSummary) : null,
          sharedRowData: sharedRowData ? JSON.parse(sharedRowData) : null,
        });
      } catch (error) {
        console.error("Error accessing localStorage:", error);
        setLocalStorageData(null);
      }
    }
  }, []);

  const handleSelect = (column: "left" | "right", index: number) => {
    const newSelection = selected[column] === index ? null : index;
    setSelected((prev) => ({
      ...prev,
      [column]: newSelection,
    }));

    // Trigger API call when a filter is selected
    if (onFilterChange) {
      if (newSelection !== null) {
        const selectedItem = column === "left" ? leftColumnFilters[newSelection] : rightColumnFilters[newSelection];
        const filterValue = filterMapping[selectedItem.label];
        if (filterValue) {
          onFilterChange(filterValue);
        }
      } else {
        // Clear filter when deselected
        onFilterChange("");
      }
    }
  };

  // Function to get analytics count for a specific filter category
  const getAnalyticsCount = (itemLabel: string): number => {
    if (!analyticsData || !analyticsData.analytics || !certificationId) {
      return 0;
    }

    const analyticsField = analyticsMapping[itemLabel];
    if (!analyticsField) {
      return 0;
    }

    // Debug logging to understand the analytics data structure
    console.log('Analytics data structure:', analyticsData);
    console.log(`Looking for field: ${analyticsField} for certificationId: ${certificationId}`);
    console.log('Available certification IDs in analytics:', Object.keys(analyticsData.analytics));

    // Get analytics data for the specific certification ID
    const analytics = analyticsData.analytics;
    const certAnalytics = analytics[certificationId];

    if (!certAnalytics) {
      console.log(`No analytics data found for certificationId: ${certificationId}`);
      return 0;
    }

    const count = certAnalytics[analyticsField];
    const result = typeof count === 'number' ? count : 0;

    console.log(`Count for ${itemLabel} (${analyticsField}) in certification ${certificationId}:`, result);
    return result;
  };

  const getDisplayValue = (
    itemLabel: string,
    isSelected: boolean
  ): number => {
    const mapped = filterMapping[itemLabel];
    if (isSelected && activeFilter && mapped === activeFilter) {
      return typeof activeCount === "number" ? activeCount : 0;
    }
    
    // If analytics data is available, use it; otherwise fall back to hardcoded values
    if (analyticsData && !analyticsLoading && certificationId) {
      console.log(`Getting display value for ${itemLabel} with certificationId: ${certificationId}`);
      return getAnalyticsCount(itemLabel);
    }
    
    return allData.find((d) => d.label === itemLabel)?.value ?? 0;
  };

  // Guided Path modal state
  const [guidedPathModalOpen, setGuidedPathModalOpen] = useState(false);
  const [guidedPathModalSource, setGuidedPathModalSource] = useState<"entitlements" | "speedPeer">(
    "entitlements"
  );
  const [peerQuickWinReviewSource, setPeerQuickWinReviewSource] = useState<"card1" | "card2" | null>(
    null
  );
  const [guidedPathModalFilter, setGuidedPathModalFilter] = useState<"Dormant" | "Access">(
    "Dormant"
  );
  const [guidedPathSelectedCount, setGuidedPathSelectedCount] = useState(0);
  const [guidedPathSelectedRows, setGuidedPathSelectedRows] = useState<any[]>([]);
  const guidedPathGridApiRef = useRef<any | null>(null);
  // Speed peer match (AI Assist - Quick Wins -> Speed -> Review)
  const [speedPeerTaskRows, setSpeedPeerTaskRows] = useState<any[]>([]);
  const [speedPeerTaskRowsLoading, setSpeedPeerTaskRowsLoading] = useState(false);
  const [speedPeerTaskRowsError, setSpeedPeerTaskRowsError] = useState<string | null>(null);
  const [speedPeerModalSearch, setSpeedPeerModalSearch] = useState("");
  const [speedPeerPageNumber, setSpeedPeerPageNumber] = useState(1);
  const [speedPeerPageSize, setSpeedPeerPageSize] = useState<number | "all">(10);
  // Quick Wins Approve confirmation state (per card)
  const [quickWinsApproveConfirmOpen, setQuickWinsApproveConfirmOpen] = useState(false);
  const [quickWinsPendingCard, setQuickWinsPendingCard] = useState<"card1" | "card2" | null>(null);
  const [quickWinsApprovedCards, setQuickWinsApprovedCards] = useState<{ card1: boolean; card2: boolean }>({
    card1: false,
    card2: false,
  });

  const guidedPathModalRows = useMemo(() => {
    const base = Array.isArray(entitlementsData) && entitlementsData.length > 0 ? entitlementsData : rowData;
    if (!Array.isArray(base)) return [] as any[];
    if (guidedPathModalFilter === "Dormant") {
      return base.filter((row: any) => {
        const flag = String(row.isdormant || row.isDormant || "").toLowerCase();
        return flag === "y" || flag === "yes" || flag === "true";
      });
    }
    // Access = show all rows
    return base;
  }, [rowData, entitlementsData, guidedPathModalFilter]);

  const speedPeerModalRowsForGrid = useMemo(() => {
    const q = speedPeerModalSearch.trim().toLowerCase();
    if (!q) return speedPeerTaskRows;
    return speedPeerTaskRows.filter((row) => {
      try {
        return JSON.stringify(row).toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [speedPeerTaskRows, speedPeerModalSearch]);

  const speedPeerModalTotalPages = useMemo(() => {
    const total = speedPeerModalRowsForGrid.length;
    if (speedPeerPageSize === "all") return 1;
    const size = speedPeerPageSize as number;
    return Math.max(1, Math.ceil(total / (size || 1)));
  }, [speedPeerModalRowsForGrid.length, speedPeerPageSize]);

  const speedPeerModalPagedRows = useMemo(() => {
    if (speedPeerPageSize === "all") return speedPeerModalRowsForGrid;
    const size = speedPeerPageSize as number;
    const start = (speedPeerPageNumber - 1) * size;
    return speedPeerModalRowsForGrid.slice(start, start + size);
  }, [speedPeerModalRowsForGrid, speedPeerPageNumber, speedPeerPageSize]);

  const speedPeerModalColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "user_displayname",
        headerName: "User",
        flex: 1,
        minWidth: 140,
        sortable: true,
        filter: true,
      },
      {
        field: "peerEntitlement",
        headerName: "Entitlement",
        flex: 1.2,
        minWidth: 180,
        sortable: true,
        filter: true,
      },
      {
        field: "peerApplication",
        headerName: "Application",
        flex: 1.2,
        minWidth: 180,
        sortable: true,
        filter: true,
      },
    ],
    []
  );

  // Column defs for Guided Path modal: add leading checkbox column for selection
  const guidedPathColumnDefs = useMemo(() => {
    if (!entitlementsColumnDefs) return entitlementsColumnDefs;
    // Strip any existing leading checkbox column from main grid (e.g. colId: "entitlementSelect")
    const withoutMainCheckbox = entitlementsColumnDefs.filter(
      (col) => (col as ColDef).colId !== "entitlementSelect"
    );
    return [
      {
        headerName: "",
        colId: "__select__",
        width: 40,
        maxWidth: 50,
        pinned: "left",
        sortable: false,
        filter: false,
        resizable: false,
        suppressMenu: true,
      } as ColDef,
      ...withoutMainCheckbox,
    ];
  }, [entitlementsColumnDefs]);

  // Auto-group column for Guided Path modal: explicitly disable built-in checkboxes
  const guidedPathAutoGroupColumnDef = useMemo(() => {
    if (!entitlementsAutoGroupColumnDef) return entitlementsAutoGroupColumnDef;
    return {
      ...entitlementsAutoGroupColumnDef,
      checkboxSelection: false,
      headerCheckboxSelection: false,
    } as ColDef;
  }, [entitlementsAutoGroupColumnDef]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Progress Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-medium text-gray-800">Progress Summary</h2>
          <button className="text-gray-400 hover:text-gray-600" aria-label="More">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
        {(() => {
          const data = ((): {
            totalItems: number;
            approvedCount: number;
            pendingCount: number;
            revokedCount: number;
            delegatedCount: number;
            remediatedCount: number;
          } => {
            // Try to get campaign-level progress data from localStorage first
            if (localStorageData?.selectedCampaignSummary) {
              try {
                const summary = localStorageData.selectedCampaignSummary;
                // If we have campaign data, use campaign-level progress
                // Use the detailed progress data stored in campaign summary
                if (summary.totalItems && summary.approvedCount !== undefined && summary.pendingCount !== undefined) {
                  return {
                    totalItems: summary.totalItems,
                    approvedCount: summary.approvedCount,
                    pendingCount: summary.pendingCount,
                    revokedCount: 0, // These would come from campaign analytics API
                    delegatedCount: 0,
                    remediatedCount: 0,
                  };
                }
                
                // Fallback to progress percentage calculation
                const totalItems = activeCount || rowData.length;
                const campaignProgress = summary.progress || 0; // Campaign progress percentage
                const approvedCount = Math.round((totalItems * campaignProgress) / 100);
                const pendingCount = totalItems - approvedCount;
                
                return {
                  totalItems,
                  approvedCount,
                  pendingCount,
                  revokedCount: 0, // These would come from campaign analytics
                  delegatedCount: 0,
                  remediatedCount: 0,
                };
              } catch (error) {
                console.error("Error parsing campaign summary:", error);
              }
            }

            // Fallback to row-level calculation if no campaign data
            const totalItems = rowData.length;
            let approvedCount = 0;
            let pendingCount = 0;
            let revokedCount = 0;
            let delegatedCount = 0;
            let remediatedCount = 0;

            rowData.forEach((row: any) => {
              const status = (row.status || "").toLowerCase();
              const aiInsights = (row.aiInsights || "").toLowerCase();
              const recommendation = (row.recommendation || "").toLowerCase();
              const action = (row.action || "").toLowerCase();

              if (
                status === "completed" ||
                status === "approved" ||
                aiInsights === "thumbs-up" ||
                recommendation === "certify" ||
                action === "approve"
              ) {
                approvedCount++;
              } else if (status === "revoked" || action === "reject" || recommendation === "revoke") {
                revokedCount++;
              } else if (status === "delegated" || action === "delegate") {
                delegatedCount++;
              } else if (status === "remediated" || action === "remediate") {
                remediatedCount++;
              } else {
                pendingCount++;
              }
            });

            return {
              totalItems,
              approvedCount,
              pendingCount,
              revokedCount,
              delegatedCount,
              remediatedCount,
            };
          })();

          return (
            <ProgressDonutChart data={data} showBreakdown={false} height="h-52" />
          );
        })()}
      </div>

      {/* Interactive Filters - wider than the other two */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-medium text-gray-800">Filters</h2>
          <button className="text-gray-400 hover:text-gray-600" aria-label="More">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-2">
            {leftColumnFilters.map((item, index) => {
              const isSelected = selected.left === index;
              const baseCount =
                analyticsLoading ? 0 : getDisplayValue(item.label, false);
              const isDisabled = !analyticsLoading && baseCount === 0;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between py-2 px-3 rounded transition-colors ${
                    isDisabled
                      ? "bg-gray-100 opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-100 border border-blue-300 cursor-pointer"
                      : "bg-gray-100 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (isDisabled) return;
                    handleSelect("left", index);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border-2"
                      style={{
                        borderColor: item.color,
                        backgroundColor: isSelected ? (item.color as string) : "transparent",
                      }}
                    ></div>
                    <span
                      className={`text-xs ${
                        isSelected ? "text-blue-900" : "text-gray-700"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? "text-blue-700 border-blue-300" : "text-gray-900 border-gray-300"
                    } bg-white border px-2 py-1 rounded min-w-[20px] text-center`}
                  >
                    {analyticsLoading
                      ? "..."
                      : getDisplayValue(item.label, isSelected)}
                  </span>
                </div>
              );
            })}
            <button
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-4"
              onClick={() => {
                setSelected({ left: null, right: null });
                // Also clear any Guided Path selections / floating actions
                guidedPathGridApiRef.current?.deselectAll();
                setGuidedPathSelectedCount(0);
                setGuidedPathSelectedRows([]);
                if (onFilterChange) {
                  onFilterChange("");
                }
              }}
            >
              {selected.left == null && selected.right == null ? (
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                </svg>
              )}
              Clear Filters
            </button>
          </div>

          {/* Right column */}
          <div className="space-y-2">
            {rightColumnFilters.map((item, index) => {
              const isSelected = selected.right === index;
              const baseCount =
                analyticsLoading ? 0 : getDisplayValue(item.label, false);
              const isDisabled = !analyticsLoading && baseCount === 0;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between py-2 px-3 rounded transition-colors ${
                    isDisabled
                      ? "bg-gray-100 opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-100 border border-blue-300 cursor-pointer"
                      : "bg-gray-100 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (isDisabled) return;
                    handleSelect("right", index);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border-2"
                      style={{
                        borderColor: item.color,
                        backgroundColor: isSelected ? (item.color as string) : "transparent",
                      }}
                    ></div>
                    <span
                      className={`text-xs ${
                        isSelected ? "text-blue-900" : "text-gray-700"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? "text-blue-700 border-blue-300" : "text-gray-900 border-gray-300"
                    } bg-white border px-2 py-1 rounded min-w-[20px] text-center`}
                  >
                    {analyticsLoading
                      ? "..."
                      : getDisplayValue(item.label, isSelected)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Assist - Quick Wins - two numbered cards with diagonal hover sweep */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-4">
        <div className="flex justify-between items-center gap-2 mb-3">
          <h2 className="text-base font-medium text-gray-800">AI Assist - Quick Wins</h2>
          <span className="flex-shrink-0 text-[10px] sm:text-xs font-semibold text-violet-900 bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-300/90 rounded-md px-2 py-0.5 shadow-sm">
            Campaign Data Insights
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {/* Card 1 */}
          <div
            className={`relative h-28 cursor-pointer overflow-hidden rounded-lg border border-blue-200 bg-blue-50 shadow-sm ${
              quickWinsApprovedCards.card1 ? "opacity-60" : ""
            }`}
            onMouseEnter={() => setHoveredCard("card1")}
            onMouseLeave={() => setHoveredCard((prev) => (prev === "card1" ? null : prev))}
          >
            {/* First page (default) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <p className="text-sm font-semibold text-blue-800">Speed</p>
              <span className="mt-1 text-xs font-bold text-blue-600">
                {loadingSpeedQuickWin
                  ? "…"
                  : speedQuickWinPercent != null
                    ? `${speedQuickWinPercent.toFixed(2)}% Completion`
                    : "—"}
              </span>
            </div>
            {/* Second page content on hover with diagonal sweep from top-right to bottom-left */}
            <div className="absolute inset-0 flex pointer-events-none">
              <div
                className="w-full h-full flex flex-col justify-between px-4 py-3 text-white rounded-lg shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.9))",
                  transform:
                    hoveredCard === "card1" ? "translate(0, 0)" : "translate(120%, -120%)",
                  transition: "transform 0.5s ease-out",
                }}
              >
                <p className="text-xs leading-snug">
                  Quick review of recommended access through peer analysis with 70% match. Reduce
                  effort by 3 hours.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1 text-xs font-medium rounded bg-white/90 text-blue-700 pointer-events-auto disabled:opacity-60"
                    disabled={quickWinsApprovedCards.card1}
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickWinsPendingCard("card1");
                      setQuickWinsApproveConfirmOpen(true);
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="px-3 py-1 text-xs font-medium rounded border border-white/80 text-white bg-transparent pointer-events-auto disabled:opacity-60"
                    disabled={quickWinsApprovedCards.card1}
                    onClick={(e) => {
                      e.stopPropagation();
                      guidedPathGridApiRef.current?.deselectAll();
                      setGuidedPathSelectedCount(0);
                      setGuidedPathSelectedRows([]);
                      setGuidedPathModalSource("speedPeer");
                      setPeerQuickWinReviewSource("card1");
                      setSpeedPeerModalSearch("");
                      setSpeedPeerTaskRows([]);
                      setSpeedPeerTaskRowsError(null);
                      setSpeedPeerTaskRowsLoading(true);
                      setGuidedPathModalFilter("Access");
                      setGuidedPathModalOpen(true);
                      void (async () => {
                        try {
                          const response = await executeQuery<any>(
                            APP_OWNER_SPEED_PEER_REVIEW_QUERY,
                            APP_OWNER_SPEED_PEER_REVIEW_PARAMETERS
                          );
                          setSpeedPeerTaskRows(normalizeSpeedPeerReviewRows(response));
                        } catch (err) {
                          setSpeedPeerTaskRowsError(
                            err instanceof Error ? err.message : "Failed to load peer match"
                          );
                          setSpeedPeerTaskRows([]);
                        } finally {
                          setSpeedPeerTaskRowsLoading(false);
                        }
                      })();
                    }}
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
            {quickWinsApprovedCards.card1 && hoveredCard === "card1" && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-xs font-medium text-white bg-black/50 px-3 py-1.5 rounded-full">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span>Already approved</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2 */}
          <div
            className={`relative h-28 cursor-pointer overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm ${
              quickWinsApprovedCards.card2 ? "opacity-60" : ""
            }`}
            onMouseEnter={() => setHoveredCard("card2")}
            onMouseLeave={() => setHoveredCard((prev) => (prev === "card2" ? null : prev))}
          >
            {/* First page (default) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <p className="text-sm font-semibold text-emerald-800">Low Risk</p>
              <span className="mt-1 text-xs font-bold text-emerald-600">
                {loadingLowRiskQuickWin
                  ? "…"
                  : lowRiskQuickWinPercent != null
                    ? `${lowRiskQuickWinPercent.toFixed(2)}% Completion`
                    : "—"}
              </span>
            </div>
            {/* Second page content on hover with diagonal sweep from top-right to bottom-left */}
            <div className="absolute inset-0 flex pointer-events-none">
              <div
                className="w-full h-full flex flex-col justify-between px-4 py-3 text-white rounded-lg shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(16, 185, 129, 0.9))",
                  transform:
                    hoveredCard === "card2" ? "translate(0, 0)" : "translate(120%, -120%)",
                  transition: "transform 0.5s ease-out",
                }}
              >
                <p className="text-xs leading-snug">
                  Quick review of existing access approved in previous cycles with low risk items.
                  Reduce effort by 2 hours.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1 text-xs font-medium rounded bg-white/90 text-emerald-700 pointer-events-auto disabled:opacity-60"
                    disabled={quickWinsApprovedCards.card2}
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickWinsPendingCard("card2");
                      setQuickWinsApproveConfirmOpen(true);
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="px-3 py-1 text-xs font-medium rounded border border-white/80 text-white bg-transparent pointer-events-auto disabled:opacity-60"
                    disabled={quickWinsApprovedCards.card2}
                    onClick={(e) => {
                      e.stopPropagation();
                      guidedPathGridApiRef.current?.deselectAll();
                      setGuidedPathSelectedCount(0);
                      setGuidedPathSelectedRows([]);
                      setGuidedPathModalSource("speedPeer");
                      setPeerQuickWinReviewSource("card2");
                      setSpeedPeerModalSearch("");
                      setSpeedPeerPageNumber(1);
                      setSpeedPeerPageSize(10);
                      setSpeedPeerTaskRows([]);
                      setSpeedPeerTaskRowsError(null);
                      setSpeedPeerTaskRowsLoading(true);
                      setGuidedPathModalOpen(true);
                      void (async () => {
                        try {
                          const response = await executeQuery<any>(
                            APP_OWNER_LOW_RISK_REVIEW_QUERY,
                            APP_OWNER_LOW_RISK_REVIEW_PARAMETERS
                          );
                          setSpeedPeerTaskRows(normalizeSpeedPeerReviewRows(response));
                        } catch (err) {
                          setSpeedPeerTaskRowsError(
                            err instanceof Error ? err.message : "Failed to load low risk review"
                          );
                          setSpeedPeerTaskRows([]);
                        } finally {
                          setSpeedPeerTaskRowsLoading(false);
                        }
                      })();
                    }}
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
            {quickWinsApprovedCards.card2 && hoveredCard === "card2" && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-xs font-medium text-white bg-black/50 px-3 py-1.5 rounded-full">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span>Already approved</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Assist - Quick Wins modal for Dormant / Access table */}
      {guidedPathModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-white rounded-lg shadow-xl mx-auto flex flex-col"
            style={{ width: "96vw", maxWidth: "1800px", maxHeight: "98vh", height: "96vh" }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">
                <span className="inline-flex items-center gap-2">
                  <span>AI Assist - Quick Wins</span>
                  <span className="text-[10px] font-semibold text-violet-900 bg-violet-100 border border-violet-300 rounded px-1.5 py-0.5">
                    Sample data
                  </span>
                </span>
                {guidedPathModalSource !== "speedPeer" && (
                  <>
                    {" – "}
                    {guidedPathModalFilter === "Dormant" ? "Dormant Access" : "All Access"}
                  </>
                )}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                onClick={() => {
                  setGuidedPathModalOpen(false);
                  setGuidedPathModalSource("entitlements");
                  setPeerQuickWinReviewSource(null);
                  guidedPathGridApiRef.current?.deselectAll();
                  setGuidedPathSelectedCount(0);
                  setGuidedPathSelectedRows([]);
                  setSpeedPeerModalSearch("");
                  setSpeedPeerTaskRows([]);
                  setSpeedPeerTaskRowsError(null);
                  setSpeedPeerTaskRowsLoading(false);
                  setSpeedPeerPageNumber(1);
                  setSpeedPeerPageSize(10);
                }}
              >
                ×
              </button>
            </div>
            {guidedPathModalSource === "speedPeer" ? (
              <div className="flex items-center gap-2 px-4 py-2 border-b">
                <span className="text-xs font-medium text-gray-500 shrink-0">Search:</span>
                <input
                  type="text"
                  placeholder="Search peer match..."
                  className="border border-gray-300 rounded px-3 py-2 text-xs flex-1 min-w-0 max-w-md"
                  value={speedPeerModalSearch}
                  onChange={(e) => {
                    setSpeedPeerModalSearch(e.target.value);
                    setSpeedPeerPageNumber(1);
                  }}
                />
                  <button
                    className="ml-auto px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    disabled={
                      speedPeerTaskRowsLoading ||
                      (peerQuickWinReviewSource === "card2"
                        ? quickWinsApprovedCards.card2
                        : quickWinsApprovedCards.card1)
                    }
                    onClick={() => {
                      setQuickWinsPendingCard(peerQuickWinReviewSource === "card2" ? "card2" : "card1");
                      setQuickWinsApproveConfirmOpen(true);
                    }}
                  >
                    Approve All
                  </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 border-b">
                <span className="text-xs font-medium text-gray-500">Filter:</span>
                <button
                  className={`px-3 py-1 text-xs rounded-full border ${
                    guidedPathModalFilter === "Dormant"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                  onClick={() => {
                    guidedPathGridApiRef.current?.deselectAll();
                    setGuidedPathSelectedCount(0);
                    setGuidedPathSelectedRows([]);
                    setGuidedPathModalFilter("Dormant");
                  }}
                >
                  Dormant Access
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded-full border ${
                    guidedPathModalFilter === "Access"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                  onClick={() => {
                    guidedPathGridApiRef.current?.deselectAll();
                    setGuidedPathSelectedCount(0);
                    setGuidedPathSelectedRows([]);
                    setGuidedPathModalFilter("Access");
                  }}
                >
                  All Access
                </button>
                  <button
                    className="ml-auto px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    disabled={quickWinsApprovedCards.card2}
                    onClick={() => {
                      setQuickWinsPendingCard("card2");
                      setQuickWinsApproveConfirmOpen(true);
                    }}
                  >
                    Approve All
                  </button>
              </div>
            )}
            <div className="flex-1 min-h-0 px-4 py-3 overflow-hidden relative">
              {guidedPathModalSource === "speedPeer" ? (
                <>
                  {speedPeerTaskRowsLoading ? (
                    <div className="text-xs text-gray-500 py-6 text-center">Loading peer match…</div>
                  ) : speedPeerTaskRowsError ? (
                    <div className="text-xs text-red-600 py-6 text-center">{speedPeerTaskRowsError}</div>
                  ) : speedPeerModalRowsForGrid.length === 0 ? (
                    <div className="text-xs text-gray-500 py-6 text-center">
                      No peer match data available.
                    </div>
                  ) : (
                    <div className="w-full ag-theme-alpine flex flex-col h-full min-h-0">
                      <div className="flex justify-center shrink-0 mb-2 [&>div]:w-full [&>div]:rounded-b-none [&>div]:border-b-0">
                        <CustomPagination
                          totalItems={speedPeerModalRowsForGrid.length}
                          currentPage={speedPeerPageNumber}
                          totalPages={speedPeerModalTotalPages}
                          pageSize={speedPeerPageSize}
                          onPageChange={(newPage) => setSpeedPeerPageNumber(newPage)}
                          onPageSizeChange={(newSize) => {
                            setSpeedPeerPageSize(newSize);
                            setSpeedPeerPageNumber(1);
                          }}
                          pageSizeOptions={[10, 25, 50, 100, "all"]}
                        />
                      </div>
                      <div className="flex-1 min-h-0">
                        <AgGridReact
                          rowData={speedPeerModalPagedRows}
                          columnDefs={speedPeerModalColumnDefs}
                          defaultColDef={entitlementsDefaultColDef}
                          domLayout="normal"
                          suppressSizeToFit={false}
                          suppressRowClickSelection={true}
                          style={{ width: "100%", minWidth: 0, height: "100%" }}
                          pagination={false}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : guidedPathModalRows.length === 0 ? (
                <div className="text-xs text-gray-500 py-6 text-center">
                  No data available for the selected filter.
                </div>
              ) : (
                <>
                  <div className="w-full ag-theme-alpine flex flex-col h-full min-h-0">
                    <div className="flex-1 min-h-0">
                      <AgGridReact
                        rowData={guidedPathModalRows}
                        columnDefs={guidedPathColumnDefs}
                        defaultColDef={entitlementsDefaultColDef}
                        autoGroupColumnDef={guidedPathAutoGroupColumnDef}
                        domLayout="normal"
                        suppressSizeToFit={false}
                        suppressRowClickSelection={true}
                        rowSelection={{
                          mode: "multiRow",
                          checkboxLocation: "primaryColumn",
                          headerCheckboxSelection: true,
                        }}
                        onGridReady={(params) => {
                          guidedPathGridApiRef.current = params.api;
                        }}
                        onSelectionChanged={(event) => {
                          try {
                            const selectedNodes = event.api.getSelectedNodes();
                            setGuidedPathSelectedCount(selectedNodes.length);
                            setGuidedPathSelectedRows(selectedNodes.map((n) => n.data));
                          } catch {
                            setGuidedPathSelectedCount(0);
                            setGuidedPathSelectedRows([]);
                          }
                        }}
                      />
                    </div>
                  </div>
                  {guidedPathSelectedCount > 1 &&
                    guidedPathSelectedRows.length > 1 &&
                    entitlementsColumnDefs && (
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-100 border border-gray-200 rounded-full shadow-lg px-3 py-1.5 flex items-center gap-2">
                        <span className="text-[11px] text-gray-600">
                          {guidedPathSelectedCount} selected
                        </span>
                        <ActionButtons
                          // For AppOwner, we don't have reviewerId/certId context here, so pass empty strings
                          api={guidedPathGridApiRef.current as any}
                          selectedRows={guidedPathSelectedRows}
                          context="entitlement"
                          reviewerId={String(certificationId || "")}
                          certId={String(certificationId || "")}
                          hideTeamsIcon
                          onActionSuccess={() => {
                            guidedPathGridApiRef.current?.deselectAll();
                            setGuidedPathSelectedCount(0);
                            setGuidedPathSelectedRows([]);
                          }}
                        />
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Assist - Quick Wins Approve All confirmation */}
      {quickWinsApproveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl mx-4 max-w-sm w-full p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Approve all records
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Are you sure you want to approve all recommended records in AI Assist - Quick Wins?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                onClick={() => {
                  setQuickWinsApproveConfirmOpen(false);
                  setQuickWinsPendingCard(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  // TODO: hook into bulk approve logic if/when implemented
                  if (quickWinsPendingCard) {
                    setQuickWinsApprovedCards((prev) => ({
                      ...prev,
                      [quickWinsPendingCard]: true,
                    }));
                  }
                  setQuickWinsPendingCard(null);
                  setQuickWinsApproveConfirmOpen(false);
                }}
              >
                Approve all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartAppOwnerComponent;
