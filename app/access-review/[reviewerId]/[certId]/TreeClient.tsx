"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import { themeQuartz } from "ag-grid-community";
import "@/lib/ag-grid-setup"; // Ensure Enterprise modules and license are loaded
import Image from "next/image";
import {
  ColDef,
  GridApi,
  ICellRendererParams,
  GetRowIdParams,
} from "ag-grid-community";
import SelectAll from "@/components/agTable/SelectAll";
import CustomPagination from "@/components/agTable/CustomPagination";
import ColumnSettings from "@/components/agTable/ColumnSettings";
import Filters from "@/components/agTable/Filters";
import ActionButtons from "@/components/agTable/ActionButtons";
import { useCertificationDetails, fetchAccessDetails } from "@/hooks/useApi";
import { getLineItemDetails, getAccessDetails, executeQuery } from "@/lib/api";
import { CertAnalytics } from "@/types/api";
import { EntitlementInfo } from "@/types/lineItem";
import { UserRowData } from "@/types/certification";
import {
  Flag,
  User,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  X,
  ArrowLeft,
} from "lucide-react";
import { InsightsIcon } from "@/components/InsightsIcon";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import "./TreeClient.css";
import { createPortal } from "react-dom";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import TaskSummaryPanel from "@/components/TaskSummaryPanel";
import DelegateActionModal from "@/components/DelegateActionModal";
import ProxyActionModal from "@/components/ProxyActionModal";
import { formatDateMMDDYY as formatDate } from "@/utils/utils";
import UserDisplayName from "@/components/UserDisplayName";
import { BackButton } from "@/components/BackButton";

interface UserPopupProps {
  username: string;
  userId: string;
  userStatus: string;
  manager: string;
  department: string;
  jobTitle: string;
  userType: "Internal" | "External";
  onClose: () => void;
}

export const UserPopup: React.FC<UserPopupProps> = ({
  username,
  userId,
  userStatus,
  manager,
  department,
  jobTitle,
  userType,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-[#d9d7d3] p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">User Details: {username}</h2>
        <div className="mb-4 space-y-2">
          <p>
            <strong>User ID:</strong> {userId}
          </p>
          <p>
            <strong>Status:</strong> {userStatus}
          </p>
          <p>
            <strong>Manager:</strong> {manager}
          </p>
          <p>
            <strong>Department:</strong> {department}
          </p>
          <p>
            <strong>Job Title:</strong> {jobTitle}
          </p>
          <p>
            <strong>User Type:</strong> {userType}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const DetailCellRenderer = (props: ICellRendererParams) => {
  const { data } = props;
  const description = data.entitlementDescription;
  const hasDescription = description && description.trim().length > 0;

  return (
    <div className="flex flex-col p-4 bg-gray-50 border-t border-gray-200 ml-10">
      <div className="flex flex-row items-center gap-2 mb-2">
        <span className="text-gray-600 text-sm font-medium">
          Entitlement Description:
        </span>
      </div>
      <div className="ml-4">
        <span
          className={hasDescription ? "text-gray-800" : "text-gray-500 italic"}
        >
          {hasDescription ? description : "No description available"}
        </span>
      </div>
    </div>
  );
};

function normalizeExecuteQueryRows(response: unknown): any[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object") {
    const o = response as Record<string, unknown>;
    if (Array.isArray(o.resultSet)) return o.resultSet as any[];
    if (Array.isArray(o.rows)) return o.rows as any[];
    if (Array.isArray(o.data)) return o.data as any[];
    if (Array.isArray(o.items)) return o.items as any[];
  }
  return [];
}

function getInsightUserContext(insight: unknown): Record<string, unknown> | null {
  if (!insight || typeof insight !== "object") return null;
  const uc = (insight as Record<string, unknown>).user_context;
  if (uc && typeof uc === "object" && !Array.isArray(uc)) return uc as Record<string, unknown>;
  return null;
}

function firstNonEmptyString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** e.g. aiassist payload: `entitlement: { entitlement_name, application }` */
function getInsightEntitlementBlock(insight: unknown): Record<string, unknown> | null {
  if (!insight || typeof insight !== "object") return null;
  const e = (insight as Record<string, unknown>).entitlement;
  if (e && typeof e === "object" && !Array.isArray(e)) return e as Record<string, unknown>;
  return null;
}

/** Map kf_insight (entitlement block, user_context) for the Speed peer grid. Intentionally ignores latest_decision.status for row/action UI. */
function extractSpeedPeerInsightFields(insight: unknown): {
  peerEntitlement: string;
  peerApplication: string;
  peerAction: string;
} {
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
    typeof uc?.entitlement === "string" ? uc.entitlement : undefined,
    ins?.entitlement_name,
    ins?.entitlementName,
  );
  const application = firstNonEmptyString(
    entBlock?.application,
    entBlock?.application_name,
    entBlock?.applicationName,
    uc?.application_name,
    uc?.applicationName,
    uc?.application_displayname,
    typeof uc?.application === "string" ? uc.application : undefined,
    ins?.application_name,
    ins?.applicationName,
    typeof ins?.application === "string" ? ins.application : undefined,
  );

  return {
    peerEntitlement: entitlement,
    peerApplication: application,
    peerAction: "",
  };
}

/** Shape a Speed peer grid row for ActionButtons (entitlement context). Does not set status/action from latest_decision (avoids prefilled Approve/Reject). */
function mapSpeedPeerRowForActionButtons(row: Record<string, unknown>): Record<string, unknown> {
  const insight = row.insight as Record<string, unknown> | undefined;
  const lineItemId = firstNonEmptyString(
    insight?.line_item_id as string | undefined,
    insight?.lineItemId as string | undefined,
    insight?.lineitemid as string | undefined
  );

  return {
    ...row,
    lineItemId: lineItemId || "",
    accountLineItemId:
      (insight?.account_line_item_id as string) ?? (insight?.accountLineItemId as string) ?? "",
    status: "",
    action: "",
    entitlementName: row.peerEntitlement,
    entitlementDescription: "",
    applicationName: row.peerApplication,
    recommendation: "",
  };
}

/** Review button: API returns one row with `result` = { resultSet: { [user_displayname]: insight[] } }. */
function normalizeSpeedPeerReviewRows(response: unknown): any[] {
  if (!response || typeof response !== "object") return [];
  const o = response as Record<string, unknown>;
  const top = (Array.isArray(o.resultSet) ? o.resultSet : Array.isArray(o.rows) ? o.rows : null) as
    | unknown[]
    | null;

  let payload: unknown = undefined;
  if (top?.length) {
    const row0 = top[0] as Record<string, unknown>;
    payload = row0?.result ?? row0;
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
  const map = inner.resultSet;
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];

  const rows: any[] = [];
  for (const [userKey, items] of Object.entries(map as Record<string, unknown>)) {
    const arr = Array.isArray(items) ? items : [];
    arr.forEach((insight, idx) => {
      const { peerEntitlement, peerApplication, peerAction } = extractSpeedPeerInsightFields(insight);
      rows.push({
        user_displayname: userKey,
        insight_index: idx,
        insight,
        peerEntitlement: peerEntitlement || "—",
        peerApplication: peerApplication || "—",
        peerAction: peerAction || "—",
      });
    });
  }
  return rows;
}

/** Peer match + Speed card %: filter by reviewer on latest_decision (see kf_insights). */
const SPEED_QUICK_WIN_PERCENT_QUERY =
  "SELECT SUM(CASE WHEN (pa ->> 'percentage')::int > ? THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS percentage FROM taskdetails t, jsonb_array_elements(t.aiassist -> 'kf_insights') AS insight, jsonb_array_elements(insight -> 'peer_analysis') AS pa WHERE insight -> 'latest_decision' ->> 'reviewer' = ?";

const SPEED_QUICK_WIN_PERCENT_THRESHOLD = 70;
/** Must match `latest_decision ->> 'reviewer'` values in taskdetails JSON. */
const SPEED_QUICK_WIN_REVIEWER_PARAM = "Jessica Camacho";

/** Speed card Review: grouped insights by user_displayname (LIMIT/OFFSET paginated server-side). */
const SPEED_PEER_REVIEW_QUERY =
  "SELECT jsonb_build_object('resultSet', COALESCE(jsonb_object_agg(user_displayname, user_items), '{}'::jsonb)) AS result FROM ( SELECT COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') AS user_displayname, jsonb_agg(insight) AS user_items FROM taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight WHERE insight -> 'latest_decision' ->> 'reviewer' = ? AND EXISTS ( SELECT 1 FROM jsonb_array_elements(COALESCE(insight -> 'peer_analysis','[]'::jsonb)) AS pa WHERE (pa ->> 'percentage') ~ '^\\d+$' AND (pa ->> 'percentage')::int > ? ) GROUP BY COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') ORDER BY user_displayname LIMIT ? OFFSET ? ) s";

const SPEED_PEER_REVIEW_PAGE_SIZE = 50;
const SPEED_PEER_REVIEW_OFFSET = 0;

/** Low Risk card %: share of kf_insights rows where entitlement_risk_level is Low for this reviewer. */
const LOW_RISK_QUICK_WIN_PERCENT_QUERY =
  "SELECT SUM(CASE WHEN insight -> 'risk_assessment' -> 'details' ->> 'entitlement_risk_level' = ? THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS percentage FROM taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight WHERE insight -> 'latest_decision' ->> 'reviewer' = ? LIMIT ? OFFSET ?";

const LOW_RISK_ENTITLEMENT_RISK_LEVEL = "Low";
const LOW_RISK_PERCENT_LIMIT = 50;
const LOW_RISK_PERCENT_OFFSET = 0;

/** Low Risk card Review table: grouped by user; parameters `["Low", "Jessica Camacho", 50, 0]`. */
const LOW_RISK_PEER_REVIEW_QUERY =
  "SELECT jsonb_build_object('resultSet', COALESCE(jsonb_object_agg(user_displayname, user_items), '{}'::jsonb)) AS result FROM ( SELECT COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') AS user_displayname, jsonb_agg(insight) AS user_items FROM taskdetails t, jsonb_array_elements(COALESCE(t.aiassist -> 'kf_insights','[]'::jsonb)) AS insight WHERE insight -> 'risk_assessment' -> 'details' ->> 'entitlement_risk_level' = ? AND insight -> 'latest_decision' ->> 'reviewer' = ? GROUP BY COALESCE(insight -> 'user_context' ->> 'user_displayname','Unknown User') ORDER BY user_displayname LIMIT ? OFFSET ? ) s";

const LOW_RISK_PEER_REVIEW_PARAMETERS: [string, string, number, number] = [
  LOW_RISK_ENTITLEMENT_RISK_LEVEL,
  SPEED_QUICK_WIN_REVIEWER_PARAM,
  LOW_RISK_PERCENT_LIMIT,
  LOW_RISK_PERCENT_OFFSET,
];

interface TreeClientProps {
  reviewerId: string;
  certId: string;
  onRowExpand?: () => void;
  onProgressDataChange?: (progressData: any) => void;
}

const TreeClient: React.FC<TreeClientProps> = ({
  reviewerId,
  certId,
  onRowExpand,
  onProgressDataChange,
}) => {
  const entitlementsGridApiRef = useRef<GridApi | null>(null);
  const entitlementsGridContainerRef = useRef<HTMLDivElement | null>(null);
  const [users, setUsers] = useState<UserRowData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRowData | null>(null);
  const [entitlementsData, setEntitlementsData] = useState<any[]>([]);
  const [unfilteredEntitlementsData, setUnfilteredEntitlementsData] = useState<any[]>([]);
  const [loadingEntitlements, setLoadingEntitlements] = useState(false);
  const [progressData, setProgressData] = useState({
    totalItems: 0,
    approvedCount: 0,
    pendingCount: 0,
    revokedCount: 0,
    delegatedCount: 0,
    remediatedCount: 0,
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [guidedPathHovered, setGuidedPathHovered] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [entitlementSearch, setEntitlementSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [actionStates, setActionStates] = useState<{
    certify: boolean;
    reject: boolean;
    remediate: boolean;
  }>({
    certify: false,
    reject: false,
    remediate: false,
  });
  const { openSidebar } = useRightSidebar();
  const [selectedRowForPanel, setSelectedRowForPanel] = useState<any | null>(null);
  const [certAnalytics, setCertAnalytics] = useState<CertAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [avatarErrorIndexByKey, setAvatarErrorIndexByKey] = useState<Record<string, number>>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  // When opened from Manage Campaign "View", we pass readonly=true in the URL
  const isReadOnly = searchParams.get("readonly") === "true";

  const pageSizeSelector = [10, 20, 50, 100];
  // Separate pagination for users sidebar - show all users by default
  const [usersPageSize, setUsersPageSize] = useState(1000);
  const [pageNumber, setPageNumber] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  
  // Get selected user ID from URL parameters
  const selectedUserIdFromUrl = searchParams.get('userId');
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Entitlements pagination - separate from users pagination
  const [entitlementsPageSize, setEntitlementsPageSize] = useState(pageSizeSelector[0]);
  const [entitlementsPageNumber, setEntitlementsPageNumber] = useState(1);
  // Server-side status filter for entitlements (maps to query string, e.g. "action eq Reject")
  const [statusFilterQuery, setStatusFilterQuery] = useState<string | undefined>(undefined);
  const [entitlementsTotalItems, setEntitlementsTotalItems] = useState(0);
  const [entitlementsTotalPages, setEntitlementsTotalPages] = useState(1);
  const suppressAutoSelectRef = useRef(false);
  const selectedUserKeyRef = useRef<string | null>(null);

  const getUserStableKey = useCallback((u: any): string => {
    return String(u?.username || u?.email || u?.userId || u?.id || "");
  }, []);

  const handleAvatarEnter = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setIsSidebarHovered(true);
      hoverTimerRef.current = null;
    }, 150);
  }, []);

  const handleAvatarLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  // Handle opening/closing of the 3-dots menu (More actions)
  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);

    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom,
        left: rect.left - 128,
      });
    }
  };

  // Close the menu when clicking anywhere outside of it or the trigger button
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (
        !target ||
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const openDelegateModal = () => {
    setIsDelegateModalOpen(true);
    setIsMenuOpen(false);
  };

  const openReassignModal = () => {
    setIsReassignModalOpen(true);
    setIsMenuOpen(false);
  };

  const getAvatarCandidates = useCallback((u: any, indexHint?: number): string[] => {
    // Available pictures in public/pictures folder
    const availablePictures = [
      "/pictures/user_image1.avif",
      "/pictures/user_image4.avif",
      "/pictures/user_image7.avif",
      "/pictures/user_image8.avif",
    ];
    
    // If user has a photoFilename, try that first
    const photoFilename = String(u?.photoFilename || "").trim();
    if (photoFilename) {
      return [`/pictures/${photoFilename}`, ...availablePictures];
    }
    
    // Assign picture based on user key or index for consistency
    const userKey = getUserStableKey(u);
    let hash = 0;
    for (let i = 0; i < userKey.length; i++) {
      hash = (hash * 31 + userKey.charCodeAt(i)) >>> 0;
    }
    
    // Use indexHint if provided, otherwise use hash
    const pictureIndex = indexHint 
      ? ((indexHint - 1) % availablePictures.length)
      : (hash % availablePictures.length);
    
    // Return the assigned picture first, then others as fallbacks
    const assignedPicture = availablePictures[pictureIndex];
    return [
      assignedPicture,
      ...availablePictures.filter(p => p !== assignedPicture)
    ];
  }, [getUserStableKey]);

  const renderUserAvatar = useCallback((u: any, size: number, roundedClass: string, indexHint?: number) => {
    if (!u) return null;
    const userKey = getUserStableKey(u);
    const candidates = getAvatarCandidates(u, indexHint);
    
    // Generate initials as fallback
    const userName = u.fullName || u.username || u.email || "U";
    const initials = userName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
    const bgColor = `hsl(${(userKey.charCodeAt(0) * 137.508) % 360}, 70%, 50%)`;
    
    // If no candidates or all candidates tried, show initials
    if (!candidates || candidates.length === 0) {
      return (
        <div
          className={`${roundedClass} flex items-center justify-center text-white font-semibold`}
          style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      );
    }
    
    const index = Math.max(0, avatarErrorIndexByKey[userKey] ?? 0);
    const src = candidates[Math.min(index, candidates.length - 1)];
    
    // If we've tried all candidates, show initials
    if (index >= candidates.length - 1 || !src) {
      return (
        <div
          className={`${roundedClass} flex items-center justify-center text-white font-semibold`}
          style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      );
    }
    
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <Image
          src={src}
          alt="User Avatar"
          width={size}
          height={size}
          className={`${roundedClass} object-cover`}
          unoptimized={true}
          loading="lazy"
          onError={(e) => {
            try {
              setAvatarErrorIndexByKey((prev) => {
                const next = { ...prev } as Record<string, number>;
                const currentIndex = prev[userKey] ?? 0;
                const nextIndex = Math.min(currentIndex + 1, candidates.length - 1);
                next[userKey] = nextIndex;
                return next;
              });
            } catch (error) {
              // Silently handle error state update failures
              console.debug('Avatar error handling failed:', error);
            }
          }}
        />
      </div>
    );
  }, [avatarErrorIndexByKey, getAvatarCandidates, getUserStableKey]);


  // Fetch cert analytics using executeQuery with two SQL queries
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!reviewerId || !certId) {
        setCertAnalytics(null);
        return;
      }
      
      // Get taskId from selected user, or fallback to first user if no user is selected
      const taskId = selectedUser?.taskId || (users.length > 0 && users[0]?.taskId ? users[0].taskId : null);
      
      if (!taskId) {
        // Wait for users to load
        return;
      }
      
      setLoadingAnalytics(true);
      // Clear previous analytics before fetching new ones
      setCertAnalytics(null);
      
      try {
        // First query: Get entitlement analytics
        const entitlementQuery = `SELECT certificationid, COUNT(*) FILTER (WHERE isnewaccess = 'Y') AS newaccess_count, COUNT(*) FILTER (WHERE itemrisk = 'High') AS highriskentitlement_count, COUNT(*) AS total_entitlements FROM vw_api_entitlement_lineitems  WHERE taskid = ?::uuid AND certificationid = ?::uuid GROUP BY certificationid`;
        
        // Second query: Get account analytics
        const accountQuery = `SELECT certificationid,COUNT(*) FILTER (WHERE isorphan = 'Y') AS orphan_count, COUNT(*) FILTER (WHERE isdormant = 'Y') AS dormant_count, COUNT(*) FILTER (WHERE isacctactive = 'N') AS inactiveaccount_count, COUNT(*) FILTER (WHERE isuseractive = 'N') AS inactiveuser_count, COUNT(*) FILTER (WHERE isviolations = 'Y') AS violations_count, COUNT(*) FILTER (WHERE isnewentity = 'Y') AS newaccount_count, COUNT(*) FILTER (WHERE itemrisk = 'High') AS highriskaccount_count, COUNT(*) AS total_accounts FROM vw_api_account_lineitems WHERE taskid = ?::uuid AND certificationid = ?::uuid GROUP BY certificationid`;
        
        const parameters = [taskId, certId];
        
        // Call both queries in parallel
        const [entitlementResponse, accountResponse] = await Promise.all([
          executeQuery<any>(entitlementQuery, parameters),
          executeQuery<any>(accountQuery, parameters)
        ]);
        
        // Combine results from both queries
        const entitlementData = entitlementResponse?.resultSet?.[0] || {};
        const accountData = accountResponse?.resultSet?.[0] || {};
        
        // Merge the results into certAnalytics format
        const combinedAnalytics: CertAnalytics = {
          newaccess_count: entitlementData.newaccess_count || 0,
          highriskentitlement_count: entitlementData.highriskentitlement_count || 0,
          orphan_count: accountData.orphan_count || 0,
          dormant_count: accountData.dormant_count || 0,
          inactiveaccount_count: accountData.inactiveaccount_count || 0,
          inactiveuser_count: accountData.inactiveuser_count || 0,
          violations_count: accountData.violations_count || 0,
          newaccount_count: accountData.newaccount_count || 0,
          highriskaccount_count: accountData.highriskaccount_count || 0,
        };
        
        setCertAnalytics(combinedAnalytics);
      } catch (error) {
        console.error("Error fetching cert analytics:", error);
        setCertAnalytics(null);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [reviewerId, certId, selectedUser, users]);

  // Calculate total certID related count from the specific certId's analytics
  const certIdCount = useMemo(() => {
    if (!certAnalytics) return 0;
    return (
      (certAnalytics.inactiveaccount_count || 0) +
      (certAnalytics.dormant_count || 0) +
      (certAnalytics.highriskentitlement_count || 0) +
      (certAnalytics.violations_count || 0) +
      (certAnalytics.orphan_count || 0) +
      (certAnalytics.newaccount_count || 0) +
      (certAnalytics.newaccess_count || 0) +
      (certAnalytics.inactiveuser_count || 0) +
      (certAnalytics.highriskaccount_count || 0)
    );
  }, [certAnalytics]);

  const selectUser = useCallback((user: UserRowData | null, updateUrl = true) => {
    if (!user) return;
    selectedUserKeyRef.current = getUserStableKey(user);
    setSelectedUser(user);
    // Update URL with selected user ID only when explicitly requested
    if (updateUrl) {
      updateUrlWithPage(pageNumber, user.id);
    }
  }, [getUserStableKey, pageNumber]);

  const { data: certificationDetailsData, error, refetch: refetchUsers } = useCertificationDetails(
    reviewerId,
    certId,
    usersPageSize,
    pageNumber
  );

  const mapUsersFromDetails = useCallback((details: any) => {
    if (!details || !details.items) return [] as any[];
    return details.items.map((task: any) => {
      const userInfo = task.userInfo || {};
      const access = task.access || {};
      const delta = task.deltaChanges || {};
      const fullName = (userInfo.firstname || "") + " " + (userInfo.lastname || "");
      return {
        id: String(task.taskId),
        ...userInfo,
        status: userInfo.status || "Active",
        manager: userInfo.manager || "Unknown",
        userType: userInfo.userType || "Internal",
        certificationId: certId,
        taskId: String(task.taskId),
        jobtitle: userInfo.jobtitle || "Unknown",
        department: userInfo.department || "Unknown",
        numOfApplications: access.numOfApplications || 0,
        numOfEntitlements: access.numOfEntitlements || 0,
        numOfApplicationsCertified: access.numOfApplicationsCertified || 0,
        numOfRolesCertified: access.numOfRolesCertified || 0,
        numOfEntitlementsCertified: access.numOfEntitlementsCertified || 0,
        profileChange: delta.profileChange || [],
        SoDConflicts: delta.SoDConflicts || [],
        addedAccounts: delta.addedAccounts || [],
        addedEntitlements: delta.addedEntitlements || [],
        fullName: fullName.trim(),
      };
    });
  }, [certId]);

  useEffect(() => {
    if (!certificationDetailsData) return;
    const mapped = mapUsersFromDetails(certificationDetailsData);
    setUsers(mapped);
    setTotalItems(certificationDetailsData.total_items || 0);
    setTotalPages(certificationDetailsData.total_pages || 1);

    const existingCampaignData = localStorage.getItem("selectedCampaignSummary");
    if (!existingCampaignData) {
      const headerData = mapped.map((user: any) => ({
        id: user.id,
        certificationName: "User Access Review",
        certificationExpiration: "2025-12-31",
        status: user.status,
        fullName: user.fullName,
        manager: user.manager,
        department: user.department,
        jobtitle: user.jobtitle,
        userType: user.userType,
        numOfEntitlements: user.numOfEntitlements ?? 0,
        numOfEntitlementsCertified: user.numOfEntitlementsCertified ?? 0,
        numOfEntitlementsRejected: user.numOfEntitlementsRejected ?? 0,
        numOfEntitlementsRevoked: user.numOfEntitlementsRevoked ?? 0,
      }));
      localStorage.setItem("sharedRowData", JSON.stringify(headerData));
      window.dispatchEvent(new Event("localStorageChange"));
    }
  }, [certificationDetailsData, mapUsersFromDetails]);

  // Aggregate status counts from certification details API (access block) for the **selected user**
  const statusCountsFromAccess = useMemo(() => {
    if (!certificationDetailsData || !selectedUser) return undefined;

    const items = certificationDetailsData.items ?? [];
    const matchingTask = items.find((task: any) => {
      try {
        return String(task.taskId) === String((selectedUser as any).taskId);
      } catch {
        return false;
      }
    });

    if (!matchingTask) return undefined;

    const access = matchingTask.access || {};
    const pending = access.numOfPendingEntitlements ?? 0;
    const certify =
      (access.numOfEntitlementsCertified ?? 0) +
      (access.numOfRolesCertified ?? 0);
    const reject =
      (access.numOfEntitlementsRevoked ?? 0) +
      (access.numOfApplicationsRevoked ?? 0) +
      (access.numOfRolesRevoked ?? 0);
    const remediated = access.numOfRemediations ?? 0;
    // API access block has no delegated count; treat as 0 for now
    const delegated = 0;
    const all = pending + certify + reject + remediated + delegated;

    return {
      All: all,
      Pending: pending,
      Certify: certify,
      Reject: reject,
      Remediated: remediated,
      Delegated: delegated,
    };
  }, [certificationDetailsData, selectedUser]);

  // Campaign-level progress from certification details (fallback when list progress not available)
  const campaignProgressFromDetails = useMemo(() => {
    if (!certificationDetailsData?.items?.length) return null;
    let total = 0;
    let completed = 0;
    certificationDetailsData.items.forEach((task: any) => {
      const access = task.access || {};
      const pending = access.numOfPendingEntitlements ?? 0;
      const certify =
        (access.numOfEntitlementsCertified ?? 0) +
        (access.numOfRolesCertified ?? 0);
      const reject =
        (access.numOfEntitlementsRevoked ?? 0) +
        (access.numOfApplicationsRevoked ?? 0) +
        (access.numOfRolesRevoked ?? 0);
      const remediated = access.numOfRemediations ?? 0;
      const delegated = 0;
      const all = pending + certify + reject + remediated + delegated;
      total += all;
      completed += certify + reject + remediated + delegated;
    });
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending: total - completed, percentage };
  }, [certificationDetailsData]);

  // Prefer campaign progress from Access Review list (same 7% as list) when user clicked from list
  const [campaignProgressFromList, setCampaignProgressFromList] = useState<{
    total: number;
    completed: number;
    pending: number;
    percentage: number;
  } | null>(null);

  // Guided Path modal state
  const [guidedPathModalOpen, setGuidedPathModalOpen] = useState(false);
  const [guidedPathModalSource, setGuidedPathModalSource] = useState<"entitlements" | "speedPeer">(
    "entitlements"
  );
  const [speedPeerTaskRows, setSpeedPeerTaskRows] = useState<any[]>([]);
  const [speedPeerTaskRowsLoading, setSpeedPeerTaskRowsLoading] = useState(false);
  const [speedPeerTaskRowsError, setSpeedPeerTaskRowsError] = useState<string | null>(null);
  const [speedPeerModalSearch, setSpeedPeerModalSearch] = useState("");
  /** Which Quick Wins card opened the peer Review modal (for Approve All / approve state). */
  const [peerQuickWinReviewSource, setPeerQuickWinReviewSource] = useState<"card1" | "card2" | null>(
    null
  );
  /** Insights use `openSidebar` only; state kept so any stale references / HMR don’t throw. */
  const [speedPeerInsightDetail, setSpeedPeerInsightDetail] = useState<unknown | null>(null);
  const [guidedPathModalPageNumber, setGuidedPathModalPageNumber] = useState(1);
  const [guidedPathModalPageSize, setGuidedPathModalPageSize] = useState<number | "all">(10);
  const [guidedPathModalFilter, setGuidedPathModalFilter] = useState<"Dormant" | "Access">(
    "Dormant"
  );
  const guidedPathGridApiRef = useRef<GridApi | null>(null);
  // Quick Wins Approve confirmation state (track per card)
  const [quickWinsApproveConfirmOpen, setQuickWinsApproveConfirmOpen] = useState(false);
  const [quickWinsPendingCard, setQuickWinsPendingCard] = useState<"card1" | "card2" | null>(null);
  const [quickWinsApprovedCards, setQuickWinsApprovedCards] = useState<{ card1: boolean; card2: boolean }>({
    card1: false,
    card2: false,
  });
  const [speedQuickWinPercent, setSpeedQuickWinPercent] = useState<number | null>(null);
  const [loadingSpeedQuickWin, setLoadingSpeedQuickWin] = useState(false);
  const [lowRiskQuickWinPercent, setLowRiskQuickWinPercent] = useState<number | null>(null);
  const [loadingLowRiskQuickWin, setLoadingLowRiskQuickWin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSpeedQuickWinPercent = async () => {
      setLoadingSpeedQuickWin(true);
      try {
        const parameters = [SPEED_QUICK_WIN_PERCENT_THRESHOLD, SPEED_QUICK_WIN_REVIEWER_PARAM];
        const response = await executeQuery<{ resultSet?: Array<{ percentage?: number | string | null }> }>(
          SPEED_QUICK_WIN_PERCENT_QUERY,
          parameters
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
        // API returns a small ratio (e.g. 0.777956…); show as percent truncated to 2 decimals (0.77%)
        setSpeedQuickWinPercent(Math.floor(num * 100) / 100);
      } catch (e) {
        console.error("Error fetching AI Quick Win Speed percentage:", e);
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

  useEffect(() => {
    let cancelled = false;
    const loadLowRiskQuickWinPercent = async () => {
      setLoadingLowRiskQuickWin(true);
      try {
        const parameters = [
          LOW_RISK_ENTITLEMENT_RISK_LEVEL,
          SPEED_QUICK_WIN_REVIEWER_PARAM,
          LOW_RISK_PERCENT_LIMIT,
          LOW_RISK_PERCENT_OFFSET,
        ];
        const response = await executeQuery<{ resultSet?: Array<{ percentage?: number | string | null }> }>(
          LOW_RISK_QUICK_WIN_PERCENT_QUERY,
          parameters
        );
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
        setLowRiskQuickWinPercent(Math.floor(num * 100) / 100);
      } catch (e) {
        console.error("Error fetching AI Quick Win Low Risk percentage:", e);
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

  const openPeerReviewQuickWinModal = useCallback((openedFromCard: "card1" | "card2") => {
    setPeerQuickWinReviewSource(openedFromCard);
    guidedPathGridApiRef.current?.deselectAll();
    setGuidedPathModalSource("speedPeer");
    setSpeedPeerModalSearch("");
    setSpeedPeerTaskRows([]);
    setSpeedPeerTaskRowsError(null);
    setSpeedPeerTaskRowsLoading(true);
    setGuidedPathModalOpen(true);
    void (async () => {
      try {
        const response = await executeQuery<any>(
          openedFromCard === "card2"
            ? LOW_RISK_PEER_REVIEW_QUERY
            : SPEED_PEER_REVIEW_QUERY,
          openedFromCard === "card2"
            ? LOW_RISK_PEER_REVIEW_PARAMETERS
            : [
                SPEED_QUICK_WIN_REVIEWER_PARAM,
                SPEED_QUICK_WIN_PERCENT_THRESHOLD,
                SPEED_PEER_REVIEW_PAGE_SIZE,
                SPEED_PEER_REVIEW_OFFSET,
              ]
        );
        setSpeedPeerTaskRows(normalizeSpeedPeerReviewRows(response));
      } catch (err) {
        setSpeedPeerTaskRowsError(
          err instanceof Error ? err.message : "Failed to load task details"
        );
        setSpeedPeerTaskRows([]);
      } finally {
        setSpeedPeerTaskRowsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("selectedCampaignSummary");
      if (!raw) return;
      const summary = JSON.parse(raw) as {
        reviewerId?: string;
        certificationId?: string;
        progress?: number;
        totalItems?: number;
        approvedCount?: number;
        pendingCount?: number;
      };
      const matchesCurrent =
        summary.reviewerId != null && summary.certificationId != null &&
        String(summary.reviewerId) === String(reviewerId) &&
        String(summary.certificationId) === String(certId);
      if (matchesCurrent && summary.progress != null && summary.totalItems != null) {
        setCampaignProgressFromList({
          total: summary.totalItems,
          completed: summary.approvedCount ?? 0,
          pending: summary.pendingCount ?? (summary.totalItems - (summary.approvedCount ?? 0)),
          percentage: summary.progress,
        });
      } else {
        setCampaignProgressFromList(null);
      }
    } catch {
      setCampaignProgressFromList(null);
    }
  }, [certId, reviewerId]);

  // Navbar: use list progress (same as Access Review page 7%) when available, else fallback to details-based
  const campaignProgress = campaignProgressFromList ?? campaignProgressFromDetails;

  const refreshUsersAndEntitlements = useCallback(async () => {
    try {
      suppressAutoSelectRef.current = true;
      const result = await refetchUsers();
      const latest = result?.data;
      if (latest) {
        const mapped = mapUsersFromDetails(latest);
        setUsers(mapped);
        setTotalItems(latest.total_items || mapped.length || 0);
        setTotalPages(latest.total_pages || 1);
        const desiredKey = selectedUserKeyRef.current || getUserStableKey(selectedUser);
        const nextSelected = mapped.find((u: any) => getUserStableKey(u) === desiredKey) || mapped[0];
        if (nextSelected) {
          selectUser(nextSelected, true);
          await loadUserEntitlements(nextSelected, entitlementsPageNumber);
        }
      } else {
        // Fallback: just refetch entitlements for current selection
        if (selectedUser) {
          await loadUserEntitlements(selectedUser, entitlementsPageNumber);
        }
      }
    } catch (e) {
      // As a final fallback, try a soft refresh
      if (selectedUser) {
        await loadUserEntitlements(selectedUser, entitlementsPageNumber);
      }
    } finally {
      suppressAutoSelectRef.current = false;
    }
  }, [refetchUsers, mapUsersFromDetails, selectedUser, entitlementsPageNumber, getUserStableKey, selectUser]);

  // Auto-select user when users are loaded or page changes
  useEffect(() => {
    if (suppressAutoSelectRef.current) return;
    if (users.length > 0) {
      if (!selectedUser) {
        // Try to find the user from URL parameters first
        let userToSelect = null;
        if (selectedUserIdFromUrl) {
          userToSelect = users.find(user => user.id === selectedUserIdFromUrl);
        }
        
        // If no user found from URL or no URL parameter, select first user
        if (!userToSelect) {
          userToSelect = users[0];
        }
        
        // Don't update URL when restoring from URL parameters
        selectUser(userToSelect, false);
        setEntitlementsPageNumber(1);
        // When user is auto-selected, set status filter to "Pending"
        setSelectedFilters(["Pending"]);
        setStatusFilterQuery("action eq Pending");
        loadUserEntitlements(userToSelect, 1, "action eq Pending");
        if (typeof onRowExpand === "function") {
          onRowExpand();
        }
      }
    }
  }, [users, selectedUser, onRowExpand, selectedUserIdFromUrl]);

  const updateUrlWithPage = (page: number, userId?: string) => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('page', page.toString());
    if (userId) {
      currentUrl.searchParams.set('userId', userId);
    }
    router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage !== pageNumber) {
      setPageNumber(newPage);
      updateUrlWithPage(newPage);
    }
  };

  const handleEntitlementsPageChange = (newPage: number) => {
    if (newPage !== entitlementsPageNumber) {
      setEntitlementsPageNumber(newPage);
      if (selectedUser) {
        loadUserEntitlements(selectedUser, newPage);
      }
    }
  };

  const loadUserEntitlements = async (
    user: UserRowData,
    page: number = 1,
    overrideStatusFilterQuery?: string
  ) => {
    if (!user.taskId) return;

    const effectiveStatusFilter = overrideStatusFilterQuery ?? statusFilterQuery;
    const isAllSelected = effectiveStatusFilter === "ALL_ACTIONS";

    // Block resizing and reset signature when loading new entitlements
    resizeBlockedRef.current = true;
    isDataLoadingRef.current = true;
    lastResizedDataSignatureRef.current = ""; // Reset signature for new data
    setLoadingEntitlements(true);
    try {
      // Prefer raw getAccessDetails response so we get entityEntitlements.items with isRemediated
      // Always fetch full data (no filter) so Certify/Reject filters can show items via client-side filtering
      const rawResponse = await getAccessDetails<any>(
        reviewerId,
        certId,
        user.taskId,
        undefined,
        entitlementsPageSize,
        page
      );
      const rawItems = rawResponse?.items ?? [];
      const hasNestedEntitlements = rawItems.length > 0 && Array.isArray(rawItems[0]?.entityEntitlements?.items);

      if (hasNestedEntitlements) {
        const buildRowFromRaw = (accountItem: any, ent: any) => {
          const appInstance = accountItem.entityAppinstance || {};
          const applicationInfo = accountItem.applicationInfo || {};
          const lineItemId = appInstance.lineItemId || "";
          const entitlementLineItemId =
            ent?.entityEntitlement?.lineItemId ?? ent?.lineItemId ?? ent?.ID ?? ent?.id ?? "";
          const nestedEntityEntitlement = ent.entityEntitlement || {};
          const entitlementInfo = ent.entitlementInfo || {};
          const entitlementName = entitlementInfo.entitlementName ?? ent.entitlementName ?? ent.name ?? "";
          const entitlementDescription = entitlementInfo.entitlementDescription ?? ent.entitlementDescription ?? "";
          const entitlementType = entitlementInfo.entitlementType ?? ent.entitlementType ?? "";
          const normalizedAction = nestedEntityEntitlement.action ?? ent.action ?? appInstance.action ?? "";
          const normalizedStatus = (() => {
            const a = String(normalizedAction).trim().toLowerCase();
            if (a === "approve") return "approved";
            if (a === "pending") return "pending";
            if (a === "reject" || a === "revoke") return "revoked";
            if (a === "delegate") return "delegated";
            if (a === "remediate") return "remediated";
            return "";
          })();
          const isRemediated = nestedEntityEntitlement.isRemediated === true || String(nestedEntityEntitlement.isRemediated || "").toUpperCase() === "Y";
          return {
            ...applicationInfo,
            ...appInstance,
            taskId: accountItem.taskId,
            applicationName: applicationInfo.applicationName ?? appInstance.itemName ?? "",
            accountName: applicationInfo.accountName ?? applicationInfo.username ?? "",
            lastLogin: applicationInfo.lastLogin,
            lineItemId: entitlementLineItemId,
            accountLineItemId: lineItemId,
            entitlementName,
            entitlementDescription,
            entitlementType,
            recommendation: ent.aiassist?.Recommendation ?? "",
            accessedWithinAMonth: ent.aiassist?.accessedWithinAMonth ?? "",
            itemRisk: nestedEntityEntitlement.itemRisk ?? appInstance.itemRisk ?? "",
            action: normalizedAction,
            status: normalizedStatus,
            newComment: nestedEntityEntitlement.newComment ?? ent.newComment ?? "",
            isRemediated,
            remediateAction: nestedEntityEntitlement.remediateAction ?? ent.remediateAction ?? "",
            remediationEndDate:
              nestedEntityEntitlement.remediateOn ??
              ent.remediateOn ??
              nestedEntityEntitlement.remediationEndDate ??
              nestedEntityEntitlement.remediateEndDate ??
              nestedEntityEntitlement.endDate ??
              nestedEntityEntitlement.itemEndDate ??
              nestedEntityEntitlement.conditionalEndDate ??
              ent.remediationEndDate ??
              "",
            remediationJustification:
              nestedEntityEntitlement.remediationJustification ??
              nestedEntityEntitlement.remediateJustification ??
              ent.remediationJustification ??
              "",
            accountId: applicationInfo.applicationEntityId ?? appInstance.accountId,
            aiassist: ent.aiassist ?? accountItem.aiassist,
          };
        };
        const allRowsFromRaw = rawItems.flatMap((accountItem: any) =>
          (accountItem.entityEntitlements?.items ?? []).map((ent: any) => buildRowFromRaw(accountItem, ent))
        );
        setEntitlementsData(allRowsFromRaw);
        setUnfilteredEntitlementsData(allRowsFromRaw);
        const progress = calculateProgressData(allRowsFromRaw);
        setProgressData(progress);
        setSelectedUser((prev) => {
          if (!prev || prev.id !== user.id) return prev;
          return {
            ...prev,
            numOfEntitlements: progress.totalItems,
            numOfEntitlementsCertified: progress.approvedCount,
            numOfEntitlementsRejected: progress.rejectedCount,
            numOfEntitlementsRevoked: progress.revokedCount,
          } as UserRowData;
        });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? {
                  ...u,
                  numOfEntitlements: progress.totalItems,
                  numOfEntitlementsCertified: progress.approvedCount,
                  numOfEntitlementsRejected: progress.rejectedCount,
                  numOfEntitlementsRevoked: progress.revokedCount,
                }
              : u
          )
        );
        onProgressDataChange?.(progress);
        setLoadingEntitlements(false);
        return;
      }

      // Fallback: use fetchAccessDetails (flattened) + getLineItemDetails per account
      const accounts = await fetchAccessDetails(
        reviewerId,
        certId,
        user.taskId,
        undefined,
        entitlementsPageSize,
        page
      );

      // Always fetch ALL entitlements for percentage calculation (unfiltered)
      const unfilteredEntitlementPromises = accounts.map(async (account: any) => {
        const lineItemId = account.lineItemId;
        if (!lineItemId) return [];
        
        // Always fetch all entitlements for percentage calculation
        const [pendingEntitlements, approveEntitlements, rejectEntitlements] = await Promise.all([
          getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            "action eq Pending"
          ),
          getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            "action eq Approve"
          ),
          getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            "action eq Reject"
          )
        ]);
        
        // Combine all results for unfiltered data; normalize account-wrapped (entityEntitlements.items) to flat entitlement items
        const combined = [...pendingEntitlements, ...approveEntitlements, ...rejectEntitlements];
        return combined.flatMap((it: any) =>
          Array.isArray(it.entityEntitlements?.items) ? it.entityEntitlements.items : [it]
        );
      });

      const entitlementPromises = accounts.map(async (account: any) => {
        const lineItemId = account.lineItemId;
        if (!lineItemId) return [];
        
        let entitlements: any[] = [];
        
        // If "All" is selected, make separate API calls for each action
        if (isAllSelected) {
          const [pendingEntitlements, approveEntitlements, rejectEntitlements] = await Promise.all([
            getLineItemDetails(
              reviewerId,
              certId,
              user.taskId,
              lineItemId,
              undefined,
              undefined,
              "action eq Pending"
            ),
            getLineItemDetails(
              reviewerId,
              certId,
              user.taskId,
              lineItemId,
              undefined,
              undefined,
              "action eq Approve"
            ),
            getLineItemDetails(
              reviewerId,
              certId,
              user.taskId,
              lineItemId,
              undefined,
              undefined,
              "action eq Reject"
            )
          ]);
          
          // Combine all results
          entitlements = [...pendingEntitlements, ...approveEntitlements, ...rejectEntitlements];
        } else {
          // Single API call with the specific filter
          entitlements = await getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            effectiveStatusFilter
          );
        }
        // Normalize: API may return account-wrapped items (entityEntitlements.items) or flat entitlement items
        const entitlementItems = entitlements.flatMap((it: any) =>
          Array.isArray(it.entityEntitlements?.items) ? it.entityEntitlements.items : [it]
        );
        return entitlementItems.map((item: any, index: number) => {
          const entitlementLineItemId =
            item?.ID ||
            item?.Id ||
            item?.id ||
            item?.lineItemId ||
            item?.LineItemId ||
            item?.lineitemid ||
            item?.entitlementId ||
            item?.EntitlementId ||
            item?.entitlementid ||
            item?.entityEntitlement?.lineItemId ||
            item?.entityEntitlements?.lineItemId ||
            item?.entityEntitlements?.[0]?.lineItemId ||
            null;

          if (!entitlementLineItemId) {
            // Debug: log a sample entitlement object to identify the correct ID field
            try {
              // Only log a few samples to avoid noise
              if (index < 3) {
                console.warn("Entitlement missing lineItemId. Sample:", {
                  keys: Object.keys(item || {}),
                  item,
                });
              }
            } catch {}
          }

          const entitlementInfo = item.entitlementInfo || item.entityEntitlement || {};
          const entitlementName = item.entitlementName || entitlementInfo.entitlementName || item.name || item.entitlement_name || "";
          const entitlementDescription = item.entitlementDescription || entitlementInfo.entitlementDescription || item.description || item.entitlement_description || "";
          const entitlementType = item.entitlementType || entitlementInfo.entitlementType || item.type || "";
          const nestedEntityEntitlement = item.entityEntitlement || {};
          const normalizedAction = nestedEntityEntitlement.action || item.action || account.action || "";
          const normalizedStatus = (() => {
            const a = String(normalizedAction).trim().toLowerCase();
            if (a === 'approve') return 'approved';
            if (a === 'pending') return 'pending';
            if (a === 'reject' || a === 'revoke') return 'revoked';
            if (a === 'delegate') return 'delegated';
            if (a === 'remediate') return 'remediated';
            return '';
          })();
          const normalizedItemRisk = nestedEntityEntitlement.itemRisk || item.itemRisk || item.entityEntitlements?.itemRisk || account.itemRisk || "";
          // Extract newComment from nested structure
          const newComment = nestedEntityEntitlement.newComment || item.newComment || account.newComment || "";

          return ({
          ...account,
          entitlementName,
          entitlementDescription,
          entitlementType,
          recommendation: item.aiassist?.Recommendation ?? "",
          accessedWithinAMonth: item.aiassist?.accessedWithinAMonth ?? "",
          itemRisk: normalizedItemRisk,
          percAccessInSameDept: item.aiassist?.percAccessInSameDept ?? "",
          percAccessWithSameJobtitle:
            item.aiassist?.percAccessWithSameJobtitle ?? "",
          percAccessWithSameManager:
            item.aiassist?.percAccessWithSameManager ?? "",
          actionInLastReview: item.aiassist?.Recommendation ?? "",
          isNew:
            user.addedEntitlements?.includes(
              item.entitlementInfo?.entitlementName
            ) ?? false,
          appTag: item.appTag || account.appTag || "",
          appRisk: item.appRisk || account.appRisk || "",
          appType: item.appType || account.appType || "",
          complianceViolation: item.complianceViolation || "",
            deltaChange: item.deltaChange || "",
            // Add action field - default to "Pending" if not set
            action: normalizedAction,
            status: normalizedStatus,
            // Use entitlement-level lineItem ID for actions, retain account line item for reference
          lineItemId: entitlementLineItemId,
          accountLineItemId: lineItemId,
          newComment: newComment, // Add newComment to row data
          isRemediated: nestedEntityEntitlement.isRemediated ?? item.isRemediated ?? false,
          remediateAction: nestedEntityEntitlement.remediateAction ?? item.remediateAction ?? "",
          remediationEndDate:
            nestedEntityEntitlement.remediateOn ??
            item.remediateOn ??
            nestedEntityEntitlement.remediationEndDate ??
            nestedEntityEntitlement.remediateEndDate ??
            nestedEntityEntitlement.endDate ??
            nestedEntityEntitlement.itemEndDate ??
            nestedEntityEntitlement.conditionalEndDate ??
            item.remediationEndDate ??
            "",
          remediationJustification:
            nestedEntityEntitlement.remediationJustification ??
            nestedEntityEntitlement.remediateJustification ??
            item.remediationJustification ??
            "",
          aiassist: item.aiassist,
          });
        });
      });

      const allRows = (await Promise.all(entitlementPromises)).flat();
      
      // Process unfiltered entitlements for percentage calculation
      const processEntitlement = (item: any, account: any) => {
        const entitlementLineItemId =
          item?.ID ||
          item?.Id ||
          item?.id ||
          item?.lineItemId ||
          item?.LineItemId ||
          item?.lineitemid ||
          item?.entitlementId ||
          item?.EntitlementId ||
          item?.entitlementid ||
          item?.entityEntitlement?.lineItemId ||
          item?.entityEntitlements?.lineItemId ||
          item?.entityEntitlements?.[0]?.lineItemId ||
          null;

        const entitlementInfo = item.entitlementInfo || item.entityEntitlement || {};
        const entitlementName = item.entitlementName || entitlementInfo.entitlementName || item.name || item.entitlement_name || "";
        const entitlementDescription = item.entitlementDescription || entitlementInfo.entitlementDescription || item.description || item.entitlement_description || "";
        const entitlementType = item.entitlementType || entitlementInfo.entitlementType || item.type || "";
          const nestedEntityEntitlement = item.entityEntitlement || {};
          const normalizedAction = nestedEntityEntitlement.action || item.action || account.action || "";
          const normalizedStatus = (() => {
            const a = String(normalizedAction).trim().toLowerCase();
            if (a === 'approve') return 'approved';
            if (a === 'pending') return 'pending';
            if (a === 'reject' || a === 'revoke') return 'revoked';
            if (a === 'delegate') return 'delegated';
            if (a === 'remediate') return 'remediated';
            return '';
          })();
          const normalizedItemRisk = nestedEntityEntitlement.itemRisk || item.itemRisk || item.entityEntitlements?.itemRisk || account.itemRisk || "";
          // Extract newComment from nested structure
          const newComment = nestedEntityEntitlement.newComment || item.newComment || account.newComment || "";

          return {
            ...account,
            entitlementName,
            entitlementDescription,
            entitlementType,
            recommendation: item.aiassist?.Recommendation ?? "",
            accessedWithinAMonth: item.aiassist?.accessedWithinAMonth ?? "",
            itemRisk: normalizedItemRisk,
            percAccessInSameDept: item.aiassist?.percAccessInSameDept ?? "",
            percAccessWithSameJobtitle: item.aiassist?.percAccessWithSameJobtitle ?? "",
            percAccessWithSameManager: item.aiassist?.percAccessWithSameManager ?? "",
            actionInLastReview: item.aiassist?.Recommendation ?? "",
            isNew: user.addedEntitlements?.includes(item.entitlementInfo?.entitlementName) ?? false,
            appTag: item.appTag || account.appTag || "",
            appRisk: item.appRisk || account.appRisk || "",
            appType: item.appType || account.appType || "",
            complianceViolation: item.complianceViolation || "",
            deltaChange: item.deltaChange || "",
            action: normalizedAction,
            status: normalizedStatus,
            lineItemId: entitlementLineItemId,
            accountLineItemId: account.lineItemId,
            newComment: newComment, // Add newComment to row data
            isRemediated: nestedEntityEntitlement.isRemediated ?? item.isRemediated ?? false,
            remediateAction: nestedEntityEntitlement.remediateAction ?? item.remediateAction ?? "",
            remediationEndDate:
              nestedEntityEntitlement.remediateOn ??
              item.remediateOn ??
              nestedEntityEntitlement.remediationEndDate ??
              nestedEntityEntitlement.remediateEndDate ??
              nestedEntityEntitlement.endDate ??
              nestedEntityEntitlement.itemEndDate ??
              nestedEntityEntitlement.conditionalEndDate ??
              item.remediationEndDate ??
              "",
            remediationJustification:
              nestedEntityEntitlement.remediationJustification ??
              nestedEntityEntitlement.remediateJustification ??
              item.remediationJustification ??
              "",
            aiassist: item.aiassist,
          };
      };

      // Process unfiltered entitlements - wait for all promises and map to accounts
      const unfilteredEntitlementsResults = await Promise.all(unfilteredEntitlementPromises);
      const unfilteredAllRows = accounts.flatMap((account: any, accountIndex: number) => {
        const unfilteredEntitlements = unfilteredEntitlementsResults[accountIndex] || [];
        return unfilteredEntitlements.map((item: any) => processEntitlement(item, account));
      });
      
      // Test data removed - filters are working correctly
      
      setEntitlementsData(allRows);
      setUnfilteredEntitlementsData(unfilteredAllRows);
      // Note: entitlementsTotalItems and entitlementsTotalPages will be updated
      // by the useEffect that watches filteredEntitlements to account for filtering

      // Calculate and update progress data using UNFILTERED data
      const progress = calculateProgressData(unfilteredAllRows);
      setProgressData(progress);

      // Update selected user's progress counts so the UI percentage reflects latest actions
      setSelectedUser((prev) => {
        if (!prev || prev.id !== user.id) return prev;
        return {
          ...prev,
          numOfEntitlements: progress.totalItems,
          numOfEntitlementsCertified: progress.approvedCount,
          numOfEntitlementsRejected: progress.rejectedCount,
          numOfEntitlementsRevoked: progress.revokedCount,
        } as UserRowData;
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                numOfEntitlements: progress.totalItems,
                numOfEntitlementsCertified: progress.approvedCount,
                numOfEntitlementsRejected: progress.rejectedCount,
                numOfEntitlementsRevoked: progress.revokedCount,
              }
            : u
        )
      );

      onProgressDataChange?.(progress);
    } catch (error) {
      console.error("Error loading entitlements:", error);
      setEntitlementsData([]);
      setUnfilteredEntitlementsData([]);
    } finally {
      setLoadingEntitlements(false);
    }
  };

  const handleUserSelect = (user: UserRowData) => {
    selectUser(user, true);
    setEntitlementsPageNumber(1);
    // Reset resize flag when user changes - loadUserEntitlements will also reset it
    hasInitialResizedRef.current = false;
    // When user changes, set status filter to "Pending"
    setSelectedFilters(["Pending"]);
    setStatusFilterQuery("action eq Pending");

    loadUserEntitlements(user, 1, "action eq Pending");
    if (typeof onRowExpand === "function") {
      onRowExpand();
    }
  };

  const getUserInitials = (fullName: string) => {
    if (!fullName) return "??";
    const names = fullName.trim().split(/\s+/);
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  // Calculate progress for a user based on their entitlements
  const getUserProgress = (user: UserRowData) => {
    // If we have entitlements data for this user, calculate from UNFILTERED data (ALL entitlements)
    if (selectedUser?.id === user.id && unfilteredEntitlementsData.length > 0) {
      const progressData = calculateProgressData(unfilteredEntitlementsData);
      const completed = progressData.approvedCount + progressData.rejectedCount + progressData.revokedCount + progressData.delegatedCount + progressData.remediatedCount;
      const percentage = progressData.totalItems > 0 ? Math.round((completed / progressData.totalItems) * 100) : 0;

      return {
        total: progressData.totalItems,
        approved: progressData.approvedCount,
        rejected: progressData.rejectedCount,
        revoked: progressData.revokedCount,
        delegated: progressData.delegatedCount,
        remediated: progressData.remediatedCount,
        completed,
        pending: progressData.pendingCount,
        percentage,
      };
    }

    // Fallback to API response data (less accurate)
    const total = user.numOfEntitlements || 0;
    const approved = user.numOfEntitlementsCertified || 0;
    const rejected = user.numOfEntitlementsRejected || 0;
    const revoked = user.numOfEntitlementsRevoked || 0;
    const completed = approved + rejected + revoked; // Certified, rejected, and revoked all count as progress
    const pending = total - completed; // Remaining entitlements are pending

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      approved,
      rejected,
      revoked,
      completed,
      pending,
      percentage,
    };
  };

  // Calculate progress data from entitlements
  const calculateProgressData = (entitlements: any[]) => {
    const totalItems = entitlements.length;
    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let revokedCount = 0;
    let delegatedCount = 0;
    let remediatedCount = 0;

    entitlements.forEach((entitlement) => {
      const action = entitlement.action || "";
      const status = entitlement.status?.toLowerCase() || "";
      const isRemediated = entitlement.isRemediated === true || String(entitlement.isRemediated || "").toUpperCase() === "Y";

      if (action === "Approve" || status === "approved") {
        approvedCount++;
      } else if (action === "Reject" || status === "rejected") {
        rejectedCount++;
      } else if (action === "Revoke" || status === "revoked") {
        revokedCount++;
      } else if (action === "Delegate" || status === "delegated") {
        delegatedCount++;
      } else if (isRemediated || action === "Remediate" || status === "remediated") {
        remediatedCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      totalItems,
      approvedCount,
      pendingCount,
      rejectedCount,
      revokedCount,
      delegatedCount,
      remediatedCount,
    };
  };

  // Notify navbar with campaign-level percentage only (not selected user)
  const dispatchProgressToNavbar = (payload: { total: number; completed: number; pending: number; percentage: number }) => {
    try {
      window.dispatchEvent(
        new CustomEvent("progressDataChange", {
          detail: {
            total: payload.total,
            approved: payload.completed,
            pending: payload.pending,
            percentage: payload.percentage,
          },
        })
      );
    } catch {}
  };

  useEffect(() => {
    if (campaignProgress) {
      dispatchProgressToNavbar(campaignProgress);
    }
  }, [campaignProgress]);

  const handleScrollUp = async () => {
    if (pageNumber > 1 && !sidebarLoading) {
      setSidebarLoading(true);
      try {
        const newPage = pageNumber - 1;
        setPageNumber(newPage);
        updateUrlWithPage(newPage);
        // The useCertificationDetails hook will automatically refetch with the new page number
      } catch (error) {
        console.error("Error loading previous page:", error);
      } finally {
        setSidebarLoading(false);
      }
    }
  };

  const handleScrollDown = async () => {
    if (pageNumber < totalPages && !sidebarLoading) {
      setSidebarLoading(true);
      try {
        const newPage = pageNumber + 1;
        setPageNumber(newPage);
        updateUrlWithPage(newPage);
        // The useCertificationDetails hook will automatically refetch with the new page number
      } catch (error) {
        console.error("Error loading next page:", error);
      } finally {
        setSidebarLoading(false);
      }
    }
  };

  const canScrollUp = pageNumber > 1;
  const canScrollDown = pageNumber < totalPages;

  // Helper function to process accounts and entitlements
  const processFilteredEntitlements = useCallback(async (accounts: any[], user: UserRowData) => {
    const effectiveStatusFilter = statusFilterQuery;
    const isAllSelected = effectiveStatusFilter === "ALL_ACTIONS";
    
    const entitlementPromises = accounts.map(async (account: any) => {
      const lineItemId = account.lineItemId;
      if (!lineItemId) return [];
      
      let entitlements: any[] = [];
      
      // If "All" is selected, make separate API calls for each action
      if (isAllSelected) {
        const [pendingEntitlements, approveEntitlements, rejectEntitlements] = await Promise.all([
          getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            "action eq Pending"
          ),
          getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            "action eq Approve"
          ),
          getLineItemDetails(
            reviewerId,
            certId,
            user.taskId,
            lineItemId,
            undefined,
            undefined,
            "action eq Reject"
          )
        ]);
        
        // Combine all results
        entitlements = [...pendingEntitlements, ...approveEntitlements, ...rejectEntitlements];
      } else {
        // Single API call with the specific filter, or no filter if undefined
        entitlements = await getLineItemDetails(
          reviewerId,
          certId,
          user.taskId,
          lineItemId,
          undefined,
          undefined,
          effectiveStatusFilter
        );
      }
      // Normalize: API may return account-wrapped items (entityEntitlements.items) or flat entitlement items
      const entitlementItems = entitlements.flatMap((it: any) =>
        Array.isArray(it.entityEntitlements?.items) ? it.entityEntitlements.items : [it]
      );
      return entitlementItems.map((item: any) => {
        const entitlementLineItemId =
          item?.ID ||
          item?.Id ||
          item?.id ||
          item?.lineItemId ||
          item?.LineItemId ||
          item?.lineitemid ||
          item?.entitlementId ||
          item?.EntitlementId ||
          item?.entitlementid ||
          item?.entityEntitlement?.lineItemId ||
          item?.entityEntitlements?.lineItemId ||
          item?.entityEntitlements?.[0]?.lineItemId ||
          null;

        const entitlementInfo = item.entitlementInfo || item.entityEntitlement || {};
        const entitlementName = item.entitlementName || entitlementInfo.entitlementName || item.name || item.entitlement_name || "";
        const entitlementDescription = item.entitlementDescription || entitlementInfo.entitlementDescription || item.description || item.entitlement_description || "";
        const entitlementType = item.entitlementType || entitlementInfo.entitlementType || item.type || "";
        const nestedEntityEntitlement = item.entityEntitlement || {};
        const normalizedAction = nestedEntityEntitlement.action || item.action || account.action || "";
        const normalizedStatus = (() => {
          const a = String(normalizedAction).trim().toLowerCase();
          if (a === 'approve') return 'approved';
          if (a === 'pending') return 'pending';
          if (a === 'reject' || a === 'revoke') return 'revoked';
          if (a === 'delegate') return 'delegated';
          if (a === 'remediate') return 'remediated';
          return '';
        })();
        const normalizedItemRisk = nestedEntityEntitlement.itemRisk || item.itemRisk || item.entityEntitlements?.itemRisk || account.itemRisk || "";
        // Extract newComment from nested structure
        const newComment = nestedEntityEntitlement.newComment || item.newComment || account.newComment || "";

        return {
          ...account,
          entitlementName,
          entitlementDescription,
          entitlementType,
          recommendation: item.aiassist?.Recommendation ?? "",
          accessedWithinAMonth: item.aiassist?.accessedWithinAMonth ?? "",
          itemRisk: normalizedItemRisk,
          percAccessInSameDept: item.aiassist?.percAccessInSameDept ?? "",
          percAccessWithSameJobtitle: item.aiassist?.percAccessWithSameJobtitle ?? "",
          percAccessWithSameManager: item.aiassist?.percAccessWithSameManager ?? "",
          actionInLastReview: item.aiassist?.Recommendation ?? "",
          isNew: user.addedEntitlements?.includes(item.entitlementInfo?.entitlementName) ?? false,
          appTag: item.appTag || account.appTag || "",
          appRisk: item.appRisk || account.appRisk || "",
          appType: item.appType || account.appType || "",
          complianceViolation: item.complianceViolation || "",
          deltaChange: item.deltaChange || "",
          action: normalizedAction,
          status: normalizedStatus,
          lineItemId: entitlementLineItemId,
          accountLineItemId: lineItemId,
          newComment: newComment, // Add newComment to row data
          isRemediated: nestedEntityEntitlement.isRemediated ?? item.isRemediated ?? false,
          remediateAction: nestedEntityEntitlement.remediateAction ?? item.remediateAction ?? "",
          remediationEndDate:
            nestedEntityEntitlement.remediateOn ??
            item.remediateOn ??
            nestedEntityEntitlement.remediationEndDate ??
            nestedEntityEntitlement.remediateEndDate ??
            nestedEntityEntitlement.endDate ??
            nestedEntityEntitlement.itemEndDate ??
            nestedEntityEntitlement.conditionalEndDate ??
            item.remediationEndDate ??
            "",
          remediationJustification:
            nestedEntityEntitlement.remediationJustification ??
            nestedEntityEntitlement.remediateJustification ??
            item.remediationJustification ??
            "",
          aiassist: item.aiassist,
        };
      });
    });

    const allRows = (await Promise.all(entitlementPromises)).flat();
    setEntitlementsData(allRows);
    setUnfilteredEntitlementsData(allRows);
    
    // Update progress data
    const progress = calculateProgressData(allRows);
    setProgressData(progress);
  }, [reviewerId, certId, statusFilterQuery]);

  // Handle filter selection
  const handleFilterToggle = useCallback(async (filterName: string) => {
    const isCurrentlySelected = selectedFilters.includes(filterName);
    
    // Map filter names to API filter strings
    const filterMap: Record<string, string> = {
      "Dormant Accounts": "isdormant eq Y",
      "High Risk": "itemrisk eq High",
      "Violation": "isviolations eq Y"
    };
    
    const apiFilter = filterMap[filterName];
    
    // Remediated is filtered client-side by isRemediated; need all entitlements loaded
    if (filterName === "Remediated" && selectedUser) {
      if (!isCurrentlySelected) {
        await loadUserEntitlements(selectedUser, 1, "ALL_ACTIONS");
      } else {
        await loadUserEntitlements(selectedUser, entitlementsPageNumber);
      }
    }
    
    // If clicking a filter that requires API call and it's being selected
    if (apiFilter && !isCurrentlySelected && selectedUser) {
      setLoadingEntitlements(true);
      try {
        const accounts = await fetchAccessDetails(
          reviewerId,
          certId,
          selectedUser.taskId,
          undefined,
          entitlementsPageSize,
          entitlementsPageNumber,
          undefined,
          undefined,
          apiFilter
        );
        await processFilteredEntitlements(accounts, selectedUser);
      } catch (error) {
        console.error(`Error loading ${filterName}:`, error);
      } finally {
        setLoadingEntitlements(false);
      }
    } else if (apiFilter && isCurrentlySelected) {
      if (selectedUser) {
        await loadUserEntitlements(selectedUser, entitlementsPageNumber);
      }
    }
    
    // Update filter selection state
    setSelectedFilters((prev) => {
      const newFilters = prev.includes(filterName)
        ? prev.filter((f) => f !== filterName)
        : [...prev, filterName];
      return newFilters;
    });
  }, [selectedFilters, selectedUser, reviewerId, certId, entitlementsPageSize, entitlementsPageNumber, loadUserEntitlements, processFilteredEntitlements]);

  // Handle filter changes from Filters component
  const handleAppliedFilter = useCallback(
    (filters: string[]) => {
      // `Filters` for status only allows a single selection at a time
      const selected = filters[0];

      // Map UI status to API filter query
      // Use a special marker for "All" so we can detect it in loadUserEntitlements
      // Remediated and Delegated are filtered client-side by isRemediated / action, so fetch all
      let nextStatusFilterQuery: string | undefined;
      if (selected === "All" || !selected) {
        nextStatusFilterQuery = "ALL_ACTIONS";
      } else if (selected === "Remediated" || selected === "Delegated") {
        nextStatusFilterQuery = "ALL_ACTIONS";
      } else if (selected === "Pending") {
        nextStatusFilterQuery = "action eq Pending";
      } else if (selected === "Certify") {
        nextStatusFilterQuery = "action eq Approve";
      } else if (selected === "Reject") {
        nextStatusFilterQuery = "action eq Reject";
      } else {
        nextStatusFilterQuery = undefined;
      }

      setStatusFilterQuery(nextStatusFilterQuery);

      // Keep local filters array for existing client-side logic (chips, etc.)
      // Don't include "All" in selectedFilters since it's handled separately
      if (filters.length > 0 && filters[0] !== "All") {
        setSelectedFilters(filters);
      } else {
        // Clear status filters and any Guided Path grid selection state
        setSelectedFilters([]);
        guidedPathGridApiRef.current?.deselectAll();
      }

      // Only reset to page 1 when filter changes; do NOT refetch - we already have full
      // entitlements data and Certify/Reject are applied client-side, so refetch would
      // replace data and can make items disappear
      if (selectedUser) {
        setEntitlementsPageNumber(1);
      }
    },
    [selectedUser]
  );

  // Handle account-level filter (Elevated, Orphan, Dormant, etc.)
  const handleAccountFilterChange = useCallback((filter: string) => {
    setAccountFilter(filter || "");
  }, []);

  // Reset entitlements pagination when filters or search change
  useEffect(() => {
    setEntitlementsPageNumber(1);
  }, [selectedFilters, entitlementSearch, accountFilter]);

  // Function to check action states from entitlements data
  const checkActionStates = useCallback(() => {
    if (!entitlementsData || entitlementsData.length === 0) {
      setActionStates({
        certify: false,
        reject: false,
        remediate: false,
      });
      return;
    }

    let hasCertify = false;
    let hasReject = false;
    let hasRemediate = false;

    for (const entitlement of entitlementsData) {
      const action = String(entitlement.action || '').trim().toLowerCase();
      const status = String(entitlement.status || '').trim().toLowerCase();

      if (action === 'approve' || status === 'approved') {
        hasCertify = true;
      }
      if (action === 'reject' || action === 'revoke' || status === 'rejected' || status === 'revoked') {
        hasReject = true;
      }
      if (entitlement.isRemediated === true || String(entitlement.isRemediated || '').toUpperCase() === 'Y') {
        hasRemediate = true;
      }

      // If all actions found, break early
      if (hasCertify && hasReject && hasRemediate) {
        break;
      }
    }

    setActionStates({
      certify: hasCertify,
      reject: hasReject,
      remediate: hasRemediate,
    });
  }, [entitlementsData]);

  // Check action states when entitlements data changes
  useEffect(() => {
    checkActionStates();
  }, [checkActionStates]);

  // Previously, dummy remediate and delegate records were added here for testing
  // They have been removed for production use so that only real entitlements are shown.

  // Filter entitlements based on selected filters
  const filteredEntitlements = useMemo(() => {
    // Helper to apply search filter
    const applySearchFilter = (rows: any[]) => {
      if (!entitlementSearch || entitlementSearch.trim() === "") return rows;
      const searchLower = entitlementSearch.toLowerCase().trim();
      return rows.filter((entitlement) => {
        const entitlementName = String(entitlement.entitlementName || "").toLowerCase();
        const applicationName = String(entitlement.applicationName || "").toLowerCase();
        const entitlementDescription = String(entitlement.entitlementDescription || "").toLowerCase();
        const accountName = String(entitlement.accountName || "").toLowerCase();
        const accountType = String(entitlement.accountType || "").toLowerCase();
        
        return (
          entitlementName.includes(searchLower) ||
          applicationName.includes(searchLower) ||
          entitlementDescription.includes(searchLower) ||
          accountName.includes(searchLower) ||
          accountType.includes(searchLower)
        );
      });
    };

    // Helper to apply account filter predicates
    const applyAccountFilter = (rows: any[]) => {
      if (!accountFilter) return rows;
      const f = accountFilter.toLowerCase();
      return rows.filter((entitlement) => {
        const accountType = String(entitlement.accountType || "").toLowerCase();
        const userStatus = String(entitlement.userStatus || selectedUser?.status || "").toLowerCase();
        const lastLogin = entitlement.lastLogin;
        const accessed = String(entitlement.accessedWithinAMonth || "").toLowerCase();
        const isNew = Boolean(entitlement.isNew);
        const itemRisk = String(entitlement.itemRisk || entitlement.appRisk || "").toLowerCase();
        const hasViolation = Array.isArray(entitlement.SoDConflicts) && entitlement.SoDConflicts.length > 0;
        const complianceViolation = Boolean(entitlement.complianceViolation);

        if (f.includes("iselevated")) return accountType === "elevated";
        if (f.includes("isorphan")) return false; // No definitive signal in current data
        if (f.includes("isterminated")) return userStatus === "terminated" || userStatus === "inactive";
        if (f.includes("isdormant")) {
          if (accessed.includes("not accessed") || accessed.includes("no")) return true;
          if (lastLogin) {
            const d = new Date(lastLogin);
            if (!isNaN(d.getTime())) {
              const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
              return diffDays > 30;
            }
          }
          return false;
        }
        if (f.includes("isnewaccess")) return isNew;
        if (f.includes("isoverprivileged")) return itemRisk === "high" || itemRisk === "critical";
        if (f.includes("iscomplianceviolation")) return hasViolation || complianceViolation;
        return true;
      });
    };

    // Start with all entitlements data
    let result = entitlementsData;

    // Apply search filter first
    result = applySearchFilter(result);

    // Apply status filters if any
    if (selectedFilters.length > 0) {
      const normalizedSelected = selectedFilters.map((f) => f.trim().toLowerCase());

      result = result.filter((entitlement) => {
        const action = String(entitlement.action || '').trim().toLowerCase();
        const status = String(entitlement.status || '').trim().toLowerCase();
        const itemRisk = String(entitlement.itemRisk || '').trim().toLowerCase();
        const deltaChange = String(entitlement.deltaChange || '').trim();
        const hasViolation = Array.isArray(entitlement.SoDConflicts) && entitlement.SoDConflicts.length > 0;

        return normalizedSelected.some((filter) => {
          if (filter === 'pending') {
            return action === 'pending' || status === 'pending';
          }
          if (filter === 'certify') {
            // Certify: action Approve (or Approved); if isRemediated is present, must be false
            const isApprove =
              action === 'approve' ||
              action === 'approved' ||
              status === 'approved';
            const hasIsRemediated = entitlement.isRemediated !== undefined && entitlement.isRemediated !== null && String(entitlement.isRemediated).trim() !== '';
            const notRemediated =
              !hasIsRemediated ||
              (entitlement.isRemediated !== true && String(entitlement.isRemediated || '').toUpperCase() !== 'Y');
            return isApprove && notRemediated;
          }
          if (filter === 'reject') {
            // Reject: action Reject/Revoke (or status revoked/rejected); if isRemediated is present, must be false
            const isRejectOrRevoke =
              action === 'reject' ||
              action === 'revoke' ||
              status === 'revoked' ||
              status === 'rejected';
            const hasIsRemediated = entitlement.isRemediated !== undefined && entitlement.isRemediated !== null && String(entitlement.isRemediated).trim() !== '';
            const notRemediated =
              !hasIsRemediated ||
              (entitlement.isRemediated !== true && String(entitlement.isRemediated || '').toUpperCase() !== 'Y');
            return isRejectOrRevoke && notRemediated;
          }
          if (filter === 'delegated') {
            return action === 'delegate' || status === 'delegated';
          }
          if (filter === 'remediated') {
            return entitlement.isRemediated === true || String(entitlement.isRemediated || '').toUpperCase() === 'Y';
          }
          // Handle chip filters shown above the table
          if (filter === 'dormant access') {
            // Check multiple indicators for dormant access
            const accessed = String(entitlement.accessedWithinAMonth || '').toLowerCase();
            const lastLogin = entitlement.lastLogin;
            // Check if account is marked as dormant (from server-side filter)
            const isDormantAccount = String(entitlement.isDormant || entitlement.isdormant || '').toUpperCase() === 'Y';
            
            // If account is marked as dormant (from server-side filter), include all entitlements
            if (isDormantAccount) {
              return true;
            }
            
            // If accessedWithinAMonth indicates not accessed, include it
            if (accessed.includes('not accessed') || accessed.includes('no')) {
              return true;
            }
            
            // If lastLogin exists and is older than 30 days, consider it dormant
            if (lastLogin) {
              const loginDate = new Date(lastLogin);
              if (!isNaN(loginDate.getTime())) {
                const diffDays = (Date.now() - loginDate.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays > 30) {
                  return true;
                }
              }
            }
            
            // If accessedWithinAMonth field is empty or not set, and we're filtering for dormant access,
            // we should still include it if it came from a dormant account (which is handled server-side)
            // For now, if the field is empty, we'll be lenient and include it
            // This handles cases where the field might not be populated but the account is dormant
            if (!accessed || accessed.trim() === '') {
              return true;
            }
            
            return false;
          }
          if (filter === 'violation') {
            return hasViolation;
          }
          if (filter === 'high risk') {
            return itemRisk === 'high' || itemRisk === 'critical';
          }
          if (filter === 'delta access') {
            return deltaChange !== '' || entitlement.isNew === true;
          }
          // Unknown filter values (e.g., chip filters) are ignored
          return false;
        });
      });
    }

    // Apply account filter on top of status filters
    result = applyAccountFilter(result);

    return result;
  }, [entitlementsData, selectedFilters, accountFilter, selectedUser, entitlementSearch]);

  // Duplicate each entitlement row with a separate description row beneath
  const entRowsWithDesc = useMemo(() => {
    if (!filteredEntitlements || filteredEntitlements.length === 0) return [] as any[];
    const rows: any[] = [];
    for (const item of filteredEntitlements) {
      rows.push(item);
      rows.push({ ...item, __isDescRow: true });
    }
    return rows;
  }, [filteredEntitlements]);

  // Ref to track current paginated data for resize logic
  const currentPaginatedDataRef = useRef<any[]>([]);

  // Paginated data for entitlements (custom pagination to handle record-description pairs)
  const entPaginatedData = useMemo(() => {
    // Since entRowsWithDesc is structured as [record1, desc1, record2, desc2, ...]
    // We need to slice by pairs: each record has its description right after it
    
    if (!entRowsWithDesc || entRowsWithDesc.length === 0) {
      currentPaginatedDataRef.current = [];
      return [];
    }
    
    // Calculate the start and end indices for the entRowsWithDesc array
    // Each "page" contains entitlementsPageSize records, which means entitlementsPageSize * 2 rows total
    const startIndex = (entitlementsPageNumber - 1) * entitlementsPageSize * 2;
    const endIndex = startIndex + (entitlementsPageSize * 2);
    
    const paginated = entRowsWithDesc.slice(startIndex, endIndex);
    currentPaginatedDataRef.current = paginated;
    return paginated;
  }, [entRowsWithDesc, entitlementsPageNumber, entitlementsPageSize]);

  // Update entitlements pagination totals based on filtered data
  useEffect(() => {
    // filteredEntitlements already contains only actual entitlement rows (no description rows)
    const totalItems = filteredEntitlements.length;
    const totalPages = Math.ceil(totalItems / entitlementsPageSize);
    
    setEntitlementsTotalItems(totalItems);
    setEntitlementsTotalPages(totalPages);
    
    // Reset to page 1 if current page is beyond available pages
    setEntitlementsPageNumber((currentPage) => {
      if (currentPage > totalPages && totalItems > 0) {
        return 1;
      }
      return currentPage;
    });
  }, [filteredEntitlements, entitlementsPageSize]);

  // Rows to show in Guided Path modal (Dormant / All Access)
  const guidedPathModalRows = useMemo(() => {
    if (!filteredEntitlements || filteredEntitlements.length === 0) return [] as any[];
    if (guidedPathModalFilter === "Dormant") {
      return filteredEntitlements.filter((entitlement: any) => {
        const lastLogin = entitlement.lastLogin;
        const accessed = String(entitlement.accessedWithinAMonth || "").toLowerCase();

        if (accessed.includes("not accessed") || accessed.includes("no")) return true;
        if (lastLogin) {
          const d = new Date(lastLogin);
          if (!isNaN(d.getTime())) {
            const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays > 30;
          }
        }
        return false;
      });
    }
    // Access = all filtered entitlements
    return filteredEntitlements;
  }, [filteredEntitlements, guidedPathModalFilter]);

  // Robust resize function that checks container readiness
  const resizeColumnsWithRetry = useCallback((maxRetries = 5, delay = 200) => {
    if (!entitlementsGridApiRef.current || !entitlementsGridContainerRef.current) {
      return;
    }

    const container = entitlementsGridContainerRef.current;
    const api = entitlementsGridApiRef.current;
    
    const attemptResize = (retryCount = 0) => {
      // Check if container has a valid width
      const containerWidth = container.offsetWidth || container.clientWidth;
      
      if (containerWidth > 0 && api) {
        try {
          // Use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            try {
              api.sizeColumnsToFit();
            } catch (error) {
              console.warn('Error resizing columns:', error);
            }
          });
        } catch (error) {
          console.warn('Error resizing columns:', error);
        }
      } else if (retryCount < maxRetries) {
        // Retry if container doesn't have width yet
        setTimeout(() => attemptResize(retryCount + 1), delay);
      }
    };

    attemptResize();
  }, []);

  // Track resize state more robustly - track by data signature to prevent resizes on same data
  const lastResizedDataSignatureRef = useRef<string>("");
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDataLoadingRef = useRef(false);
  const resizeBlockedRef = useRef(false);
  const hasInitialResizedRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  
  // Create a signature from the data to track when data actually changes
  const getDataSignature = useCallback((data: any[]) => {
    if (!data || data.length === 0) return "empty";
    // Create signature from first few rows and total length
    const sample = data.slice(0, 3).map((d: any) => d.lineItemId || d.entitlementName || "").join("|");
    return `${data.length}-${sample}`;
  }, []);
  
  // Debounced resize function to prevent multiple rapid calls
  const debouncedResize = useCallback((dataSignature: string) => {
    if (resizeBlockedRef.current) return;
    
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(() => {
      if (entitlementsGridApiRef.current && entitlementsGridContainerRef.current && !resizeBlockedRef.current) {
        // Only resize if data signature changed
        if (lastResizedDataSignatureRef.current !== dataSignature) {
          resizeColumnsWithRetry(3, 50);
          lastResizedDataSignatureRef.current = dataSignature;
        }
      }
      resizeTimeoutRef.current = null;
    }, 200);
  }, [resizeColumnsWithRetry]);

  // Handle column resizing when container size changes (e.g., sidebar expand/collapse, navigation)
  useEffect(() => {
    if (!entitlementsGridApiRef.current || !entitlementsGridContainerRef.current) return;

    // Use ResizeObserver to detect container size changes (only when not loading)
    const resizeObserver = new ResizeObserver(() => {
      // Skip resize during data loading
      if (isDataLoadingRef.current || resizeBlockedRef.current) return;
      
      const currentSignature = getDataSignature(entPaginatedData);
      debouncedResize(currentSignature);
    });

    resizeObserver.observe(entitlementsGridContainerRef.current);

    // Resize when sidebar visibility changes (only when not loading)
    const sidebarTimeout = setTimeout(() => {
      if (!isDataLoadingRef.current && !resizeBlockedRef.current) {
        const currentSignature = getDataSignature(entPaginatedData);
        if (lastResizedDataSignatureRef.current !== currentSignature) {
          resizeColumnsWithRetry(3, 50);
          lastResizedDataSignatureRef.current = currentSignature;
        }
      }
    }, 400); // Wait for sidebar animation to complete

    return () => {
      resizeObserver.disconnect();
      clearTimeout(sidebarTimeout);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isSidebarHovered, resizeColumnsWithRetry, debouncedResize, entPaginatedData, getDataSignature]);
  
  // Block resizing during data loading
  useEffect(() => {
    if (loadingEntitlements) {
      isDataLoadingRef.current = true;
      resizeBlockedRef.current = true;
    } else {
      // Unblock after a short delay to allow rendering to complete
      setTimeout(() => {
        isDataLoadingRef.current = false;
        resizeBlockedRef.current = false;
      }, 500);
    }
  }, [loadingEntitlements]);

  const filterOptions = [
    {
      name: "Dormant Accounts",
      color: "bg-yellow-100 border-yellow-300 text-yellow-800",
    },
    { name: "Violation", color: "bg-red-100 border-red-300 text-red-800" },
    {
      name: "High Risk",
      color: "bg-orange-100 border-orange-300 text-orange-800",
    },
    {
      name: "Delta Access",
      color: "bg-blue-100 border-blue-300 text-blue-800",
    },
  ];

  // Entitlements column definitions
  const entitlementsColumnDefs = useMemo<ColDef[]>(
    () => {
      const cols: ColDef[] = [
      {
        field: "entitlementName",
        headerName: "Entitlement",
        flex: 2.2,
        minWidth: 300,
        autoHeight: true,
        wrapText: true,
        colSpan: (params) => {
          if (!params.data?.__isDescRow) return 1;
          try {
            const center = (params.api as any)?.getDisplayedCenterColumns?.() || [];
            const left = (params.api as any)?.getDisplayedLeftColumns?.() || [];
            const right = (params.api as any)?.getDisplayedRightColumns?.() || [];
            const total = center.length + left.length + right.length;
            if (total > 0) return total;
          } catch {}
          const all = (params as any)?.columnApi?.getAllDisplayedColumns?.() || [];
          return all.length || 1;
        },
        cellRenderer: (params: ICellRendererParams) => {
          const { entitlementName, isNew, itemRisk, entitlementDescription } =
            params.data || {};
          if (params.data?.__isDescRow) {
            const desc = entitlementDescription || "No description available";
            const isEmpty = !entitlementDescription || entitlementDescription.trim().length === 0;
            return (
              <div className={`text-sm w-full break-words whitespace-pre-wrap ${isEmpty ? "text-gray-400 italic" : "text-gray-600"}`}>
                {isEmpty ? "No description available" : desc}
              </div>
            );
          }
          const risk = String(itemRisk || "").toLowerCase().trim();
          const isHighRisk = risk === "high" || risk === "critical";
          const textColor = isHighRisk ? "#dc2626" : undefined;
          return (
            <div className="flex h-full py-1">
              <span 
                className="text-xs mt-3 font-bold"
                style={textColor ? { color: textColor } : {}}
              >
                {entitlementName}
              </span>
            </div>
          );
        },
      },
      { field: "entitlementType", headerName: "Type", width: 120 },
      {
        field: "user",
        headerName: "Account",
        width: 150,
        cellRenderer: (params: ICellRendererParams) => {
          const { user, accountName, accountname, username, accountType, SoDConflicts, itemRisk } = params.data || {};
          const typeLabel = accountType || "Regular";
          const hasViolation = SoDConflicts && SoDConflicts.length > 0;
          const risk = String(itemRisk || "").toLowerCase().trim();
          const isHighRisk = risk === "high" || risk === "critical";
          const textColor = isHighRisk ? "#dc2626" : undefined;
          const displayAccount =
            user ||
            accountName ||
            accountname ||
            username ||
            "";
          const lines = String(displayAccount).split("\n");
          if (!lines[1]) lines[1] = typeLabel;
          return (
            <div className="flex items-center gap-4 font-normal text-sm mt-2">
              <div className="flex items-center gap-2">
                <span 
                  className="font-normal text-sm"
                  style={textColor ? { color: textColor } : {}}
                >
                  {lines[0]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {}
                {hasViolation && (
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 relative z-50"
                    title="Audit/SOD Violation"
                  >
                    <Flag height={10} color="red" className="text-sm" />
                  </div>
                )}
                {/* <span 
                  className="font-normal text-sm"
                  style={textColor ? { color: textColor } : {}}
                >
                  {lines[1]}
                </span> */}
              </div>
            </div>
          );
        },
      },
      {
        field: "applicationName",
        headerName: "Application",
        width: 150,
      },
      { 
        field: "lastLogin", 
        headerName: "Last Login", 
        width: 140,
        cellRenderer: (params: ICellRendererParams) => {
          const { lastLogin } = params.data || {};
          if (!lastLogin) return <span className="text-gray-400">-</span>;
          
          try {
            const formatted = formatDate(lastLogin);
            if (!formatted) {
              return <span className="text-gray-400">-</span>;
            }
            return <span className="text-sm">{formatted}</span>;
          } catch (error) {
            return <span className="text-gray-400">-</span>;
          }
        }
      },
      {
        field: "recommendation",
        headerName: "Insights",
        width: 140,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: ICellRendererParams) => {
          const { accessedWithinAMonth } = params.data || {};
          return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center mb-1" title="AI Insights">
                <InsightsIcon size={24} className="shrink-0 text-amber-500" />
              </div>
              <small className="text-xs text-center" title="Review History">
                {accessedWithinAMonth}
              </small>
            </div>
          );
        },
        onCellClicked: (event: any) => {
          const rowData = event?.data || null;
          if (rowData && selectedUser) {
            // Add job title and other user info to the row data for the sidebar
            setSelectedRowForPanel({
              ...rowData,
              jobtitle: selectedUser.jobtitle,
              fullName: selectedUser.fullName,
              department: selectedUser.department
            });
          } else {
            setSelectedRowForPanel(rowData);
          }
          const panel = (
            <div>
              <TaskSummaryPanel
                headerLeft={{
                  primary: selectedUser?.fullName || rowData?.user || "",
                  secondary: rowData?.user || "",
                }}
                headerRight={{
                  primary: rowData?.entitlementName || "",
                  secondary: rowData?.applicationName || "Application",
                }}
                riskLabel={rowData?.itemRisk || rowData?.appRisk || "Critical"}
                jobTitle={selectedUser?.jobtitle}
                applicationName={rowData?.applicationName}
                reviewerId={reviewerId}
                certId={certId}
                selectedRow={rowData}
                onActionSuccess={() => {
                  refreshUsersAndEntitlements();
                  // Check action states after refresh
                  setTimeout(() => {
                    checkActionStates();
                  }, 500);
                }}
              />
            </div>
          );
          openSidebar(panel, { widthPx: 500, title: "Insights" });
        },
      },
    ];

      if (!isReadOnly) {
        cols.push({
          headerName: "Actions",
          width: 250,
          minWidth: 230,
          maxWidth: 290,
          cellRenderer: (params: ICellRendererParams) => {
          // Check if current row is selected
          const isCurrentRowSelected = params.node?.isSelected() || false;
          
          // Check if any other row is selected
          let hasOtherSelectedRows = false;
          if (params.api) {
            const selectedRows = params.api.getSelectedRows();
            hasOtherSelectedRows = selectedRows.some((row: any) => {
              const rowId = row.lineItemId || row.accountLineItemId || row.taskId || `${row.applicationName}-${row.entitlementName}`;
              const currentRowId = params.data?.lineItemId || params.data?.accountLineItemId || params.data?.taskId || `${params.data?.applicationName}-${params.data?.entitlementName}`;
              return rowId === currentRowId ? false : !row.__isDescRow;
            });
          }
          
          // Disable Action column if current row is NOT selected but some other row IS selected
          const shouldDisable = !isCurrentRowSelected && hasOtherSelectedRows;

          // Extract email from user field, selectedUser, or row data
          const userField = params.data?.user || "";
          const emailMatch = userField.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          // Try multiple sources for email, use selectedUser as fallback since all rows are for the same user
          let userEmail = emailMatch 
            ? emailMatch[1] 
            : (params.data?.email || selectedUser?.email || selectedUser?.username || "");
          
          // If still no email, use default for testing
          if (!userEmail && selectedUser?.fullName) {
            // Try to construct email from fullName (fallback)
            const nameParts = selectedUser.fullName.split(' ');
            if (nameParts.length > 0) {
              userEmail = nameParts[0] + '@icallidus.com';
            }
          }
          
          // Final fallback
          if (!userEmail) {
            userEmail = "Harish.jangada@icallidus.com";
          }

          return (
            <div className={shouldDisable ? "opacity-50 pointer-events-none" : ""}>
              <ActionButtons
                api={params.api}
                selectedRows={[params.data]}
                context="entitlement"
                reviewerId={reviewerId}
                certId={certId}
                userEmail={userEmail}
                selectedFilters={selectedFilters}
                // Removed onActionSuccess to prevent table refresh on action button clicks
                // Table will refresh only when actions are actually submitted via the Submit button
              />
            </div>
          );
        },
        sortable: false,
        filter: false,
        resizable: false,
      });
      }

      return cols;
    },
    [certId, reviewerId, isReadOnly, selectedFilters, selectedUser, refreshUsersAndEntitlements, openSidebar]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  );

  const speedPeerModalColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "user_displayname",
        headerName: "User",
        flex: 1,
        minWidth: 120,
        sortable: true,
        filter: true,
      },
      {
        field: "peerEntitlement",
        headerName: "Entitlement",
        flex: 2.4,
        minWidth: 260,
        sortable: true,
        filter: true,
      },
      {
        field: "peerApplication",
        headerName: "Application",
        flex: 1.15,
        minWidth: 140,
        sortable: true,
        filter: true,
      },
      {
        colId: "insights_icon",
        headerName: "Insights",
        width: 112,
        maxWidth: 130,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <div className="flex items-center justify-center h-full min-h-[36px] py-1">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-1.5 text-amber-600 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                aria-label="View insights"
                onClick={(e) => {
                  e.stopPropagation();
                  const row = params.data as Record<string, unknown> | undefined;
                  const insight = row?.insight;
                  if (!insight || typeof insight !== "object") return;
                  const userDisplay = String(row?.user_displayname ?? "");
                  const entName = String(row?.peerEntitlement ?? "");
                  const appName = String(row?.peerApplication ?? "");
                  const ra = (insight as Record<string, unknown>).risk_assessment as
                    | { overall_risk?: string }
                    | undefined;
                  const selectedRow = {
                    aiassist: { kf_insights: [insight] },
                    entitlementName: entName,
                    applicationName: appName,
                  };
                  openSidebar(
                    <div>
                      <TaskSummaryPanel
                        headerLeft={{
                          primary: userDisplay,
                          secondary: userDisplay,
                        }}
                        headerRight={{
                          primary: entName,
                          secondary: appName,
                        }}
                        riskLabel={ra?.overall_risk ?? "—"}
                        applicationName={appName}
                        reviewerId={reviewerId}
                        certId={certId}
                        selectedRow={selectedRow}
                      />
                    </div>,
                    { widthPx: 500, title: "Insights" }
                  );
                }}
              >
                <InsightsIcon size={20} className="text-amber-500" />
              </button>
            </div>
          );
        },
      },
      {
        colId: "peer_actions",
        headerName: "Action",
        width: 240,
        minWidth: 220,
        maxWidth: 280,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const row = params.data as Record<string, unknown> | undefined;
          if (!row) return null;
          const mapped = mapSpeedPeerRowForActionButtons(row);
          return (
            <div
              className="flex items-center h-full min-h-[40px] py-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <ActionButtons
                api={params.api as GridApi}
                selectedRows={[mapped] as any}
                context="entitlement"
                reviewerId={reviewerId}
                certId={certId}
                selectedFilters={selectedFilters}
                hideTeamsIcon
              />
            </div>
          );
        },
      },
    ],
    [openSidebar, reviewerId, certId, selectedFilters]
  );

  const guidedPathModalRowsForGrid = useMemo(() => {
    if (guidedPathModalSource === "speedPeer") {
      const rows = speedPeerTaskRows;
      const q = speedPeerModalSearch.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter((row: any) => {
        try {
          return JSON.stringify(row).toLowerCase().includes(q);
        } catch {
          return false;
        }
      });
    }
    return guidedPathModalRows;
  }, [guidedPathModalSource, speedPeerTaskRows, speedPeerModalSearch, guidedPathModalRows]);

  const guidedPathModalGridColumnDefs = useMemo<ColDef[]>(() => {
    if (guidedPathModalSource === "speedPeer") {
      return speedPeerModalColumnDefs.filter(
        (col) => col.colId !== "peer_actions" && col.colId !== "insights_icon"
      );
    }
    return entitlementsColumnDefs.filter(
      (col) => col.headerName !== "Actions" && col.headerName !== "Insights"
    );
  }, [guidedPathModalSource, speedPeerModalColumnDefs, entitlementsColumnDefs]);

  const guidedPathModalTotalPages = useMemo(() => {
    const total = guidedPathModalRowsForGrid.length;
    if (guidedPathModalPageSize === "all") return 1;
    const size = guidedPathModalPageSize as number;
    return Math.max(1, Math.ceil(total / size) || 1);
  }, [guidedPathModalRowsForGrid.length, guidedPathModalPageSize]);

  const guidedPathModalPagedRows = useMemo(() => {
    const all = guidedPathModalRowsForGrid;
    if (guidedPathModalPageSize === "all") return all;
    const size = guidedPathModalPageSize as number;
    const start = (guidedPathModalPageNumber - 1) * size;
    return all.slice(start, start + size);
  }, [guidedPathModalRowsForGrid, guidedPathModalPageNumber, guidedPathModalPageSize]);

  useEffect(() => {
    if (!guidedPathModalOpen) return;
    setGuidedPathModalPageNumber(1);
  }, [guidedPathModalOpen, guidedPathModalFilter, speedPeerModalSearch, guidedPathModalSource]);

  useEffect(() => {
    if (!guidedPathModalOpen) return;
    setGuidedPathModalPageNumber((p) => Math.min(p, guidedPathModalTotalPages));
  }, [guidedPathModalOpen, guidedPathModalTotalPages]);

  return (
    <div className="flex flex-row relative h-screen">
      {error && (
        <div style={{ color: "red", padding: 10 }}>{String(error)}</div>
      )}
      {/* Right sidebar content is rendered globally via RightSideBarHost */}

      {/* Left Sidebar Container - Back Button and User List */}
      <div
        className={`border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-30 shadow-sm ${
          isSidebarHovered ? "w-64" : "w-20"
        }`}
        style={{ height: "100vh" }}
      >
        {/* Back Button */}
        <div className="flex items-center justify-center border-b border-gray-300 px-2 py-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Users List */}
        <div
          className="bg-gradient-to-b from-gray-50 to-white flex flex-col flex-1 overflow-hidden mt-2 transition-all duration-300 ease-in-out"
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
        {/* User Search */}
        <div className="px-2 py-2 border-b border-gray-200 bg-white flex items-center">
          <div className="relative w-full">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={isSidebarHovered ? "Search users..." : ""}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            {userSearch && (
              <button
                onClick={() => setUserSearch("")}
                className="absolute right-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Users List - Vertical Scroll */}
        <div className="flex flex-col items-start pb-2 pt-0 px-2 overflow-x-hidden flex-1 w-full gap-1 overflow-y-auto hide-scrollbar">
          {sidebarLoading ? (
            <div className="flex items-center justify-center w-full">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <div className="w-3.5 h-3.5 animate-spin border-2 border-blue-500 border-t-transparent rounded-full"></div>
                Loading users...
              </div>
            </div>
          ) : (
            users
              .filter((user) =>
                (user.fullName || "")
                  .toLowerCase()
                  .includes(userSearch.trim().toLowerCase())
              )
              .map((user, index) => {
                const progress = getUserProgress(user);
                const isSelected = selectedUser?.id === user.id;
                return (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`user-item cursor-pointer w-full ${
                      isSidebarHovered ? "px-2 pb-2 pt-0 rounded-lg" : "px-1 pb-1 pt-0"
                    } ${
                      isSidebarHovered
                        ? isSelected
                          ? "bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-500 shadow-sm"
                          : "bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm"
                        : ""
                    }`}
                    style={{ 
                      minHeight: isSidebarHovered ? 'auto' : '60px',
                      transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div
                      className={`flex ${
                        isSidebarHovered ? "flex-row items-center gap-2" : "flex-col items-center justify-center gap-1"
                      } w-full transition-all duration-300 ease-in-out`}
                    >
                      {/* User Avatar/Initials */}
                      <div
                        className="relative flex-shrink-0"
                        onMouseEnter={handleAvatarEnter}
                        onMouseLeave={handleAvatarLeave}
                      >
                        {!isSidebarHovered ? (
                          <div className="flex items-center justify-center w-full">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
                                isSelected
                                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-1 ring-blue-300"
                                  : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 hover:from-blue-200 hover:to-blue-300"
                              }`}
                              style={{
                                transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                              title={user.fullName || ""}
                            >
                              {getUserInitials(user.fullName || "")}
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            {renderUserAvatar(user, 48, "w-10 h-10 rounded-full shadow-sm", index + 1) || (
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                                  isSelected
                                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-1 ring-blue-300"
                                    : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700"
                                }`}
                                style={{
                                  transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}
                              >
                                {getUserInitials(user.fullName || "")}
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* User Details - only visible when expanded */}
                      {isSidebarHovered && (
                        <div 
                          className="flex flex-col items-start gap-1 min-w-0 w-full flex-1"
                          style={{
                            animation: 'fadeInSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        >
                          <span
                            className={`font-medium w-full truncate whitespace-nowrap ${
                              isSelected
                                ? "text-blue-800"
                                : "text-gray-900"
                            }`}
                            style={{ fontSize: '11px' }}
                            title={user.fullName || ""}
                          >
                            {user.fullName}
                          </span>
                          
                          {/* Progress Bar */}
                          <div className="w-full flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-0">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progress.percentage === 100
                                    ? "bg-gradient-to-r from-green-400 to-green-500"
                                    : progress.percentage >= 50
                                    ? "bg-gradient-to-r from-blue-400 to-blue-500"
                                    : "bg-gradient-to-r from-yellow-400 to-yellow-500"
                                }`}
                                style={{ width: `${progress.percentage}%` }}
                              ></div>
                            </div>
                            <span className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                              isSelected ? "text-blue-700" : "text-gray-600"
                            }`}>
                              {progress.percentage}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
        </div>
      </div>

      {/* Entitlements Table */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto" style={{ marginLeft: 0, padding: '0 1rem 1rem 1rem' }}>
        {selectedUser && (
          <>
            <div className="flex flex-col lg:flex-row gap-4 mb-4 items-stretch">
              {/* User Information Card - 2/3 */}
              <div className="w-full lg:w-2/3 flex">
            <div className="bg-white border border-gray-200 rounded-lg px-2 pb-2 pt-0 shadow-sm w-full flex-1">
              {/* Upper section: Name, Status, Buttons */}
              <div className="flex items-center justify-between gap-3 bg-gray-50 p-3 rounded-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                    {renderUserAvatar(selectedUser, 48, "object-cover rounded-full w-12 h-12") || (
                      <div className="w-12 h-12 rounded-full bg-blue-200 text-blue-600 flex items-center justify-center font-semibold text-sm">
                        {getUserInitials(selectedUser?.fullName || "")}
                      </div>
                    )}
                  </div>
                    <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-lg font-bold text-gray-900 truncate">
                        <span className="flex items-center gap-2">
                          {(selectedUser.status || "ACTIVE").toLowerCase() === "active" && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          <UserDisplayName
                            displayName={selectedUser.fullName || "Unknown User"}
                            userType={selectedUser.userType}
                            employeetype={selectedUser.employeetype}
                            tags={selectedUser.tags}
                          />
                        </span>
                      </h4>
                      <div className="flex items-center space-x-2 ml-4">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs font-medium text-gray-500">
                          Job Title:
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          {selectedUser.jobtitle || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-xs font-medium text-gray-500">
                          Department:
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                          {selectedUser.department || "Unknown"}
                        </span>
                      </div>
                    </div>
                    {/* User Progress Display */}
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const progress = getUserProgress(selectedUser);
                        return (
                          <>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium text-gray-600">
                              {progress.percentage}%
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                        <button
                          ref={menuButtonRef}
                          onClick={toggleMenu}
                          title="More Actions"
                          className={`cursor-pointer rounded-sm hover:opacity-80 ${
                            isMenuOpen ? "bg-[#6D6E73]/20" : ""
                          }`}
                          aria-label="More actions"
                        >
                          <MoreVertical
                            color="#35353A"
                            size="32"
                            className="transform scale-[0.6]"
                          />
                        </button>
                        <div className="relative flex items-center">
                          {isMenuOpen &&
                            createPortal(
                              <div
                                ref={menuRef}
                                className="absolute bg-white border border-gray-300 shadow-lg rounded-md z-50"
                                style={{
                                  position: "fixed",
                                  top: `${menuPosition.top}px`,
                                  left: `${menuPosition.left}px`,
                                  minWidth: "160px",
                                  padding: "8px",
                                }}
                              >
                                <ul className="py-2 text-sm text-gray-700">
                                  {}
                                  <li
                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={openReassignModal}
                                  >
                                    Reassign
                                  </li>
                                  <li
                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={openDelegateModal}
                                  >
                                    Delegate
                                  </li>
                                </ul>
                              </div>,
                              document.body
                            )}
                        </div>
                </div>
              </div>

              {/* Lower section: Filters and Controls */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 mb-3 w-full">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-xs font-bold text-gray-500">
                      Filters:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {filterOptions.map((filter) => {
                      const isSelected = selectedFilters.includes(filter.name);
                      // Get corresponding count from certAnalytics
                      let count = 0;
                      if (certAnalytics) {
                        if (filter.name === "Dormant Accounts") {
                          count = certAnalytics.dormant_count || 0;
                        } else if (filter.name === "Violation") {
                          count = certAnalytics.violations_count || 0;
                        } else if (filter.name === "High Risk") {
                          count = certAnalytics.highriskentitlement_count || 0;
                        } else if (filter.name === "Delta Access") {
                          count = certAnalytics.newaccess_count || 0;
                        }
                      }
                      const isDisabled = count === 0;
                      return (
                        <div
                          key={filter.name}
                          className={`
                            px-3 py-1 rounded-md border transition-all duration-200 text-xs flex items-center justify-between gap-1.5 min-w-[120px]
                            ${
                              isDisabled
                                ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                                : isSelected
                                ? `${filter.color} shadow-sm cursor-pointer`
                                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer"
                            }
                          `}
                        >
                          <span
                            className="font-medium flex-1"
                            onClick={() => {
                              if (isDisabled) return;
                              handleFilterToggle(filter.name);
                            }}
                          >
                            {filter.name}
                            {count > 0 && (
                              <span className="ml-1 font-bold">({count})</span>
                            )}
                          </span>
                          {isSelected && !isDisabled && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFilterToggle(filter.name);
                              }}
                              className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors flex-shrink-0"
                              title="Remove filter"
                            >
                              <X size={12} className="text-current" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Entitlements Table Controls */}
                <div className="flex items-center justify-between flex-wrap gap-3 w-full">
                  <div className="flex items-center gap-4 flex-wrap w-full">
                    {!isReadOnly && (
                      <SelectAll
                        gridApi={entitlementsGridApiRef.current}
                        detailGridApis={new Map()}
                        clearDetailGridApis={() => {}}
                        context="entitlement"
                        reviewerId={reviewerId}
                        certId={certId}
                        selectedFilters={selectedFilters}
                        allFilteredData={filteredEntitlements}
                        getRowId={(data: any) => {
                          const baseId = data.lineItemId || data.accountLineItemId || data.taskId || `${data.applicationName}-${data.entitlementName}`;
                          return data.__isDescRow ? `${baseId}-desc` : baseId;
                        }}
                        onRowDataChange={(data: any[]) => {
                          // This will be handled by the SelectAll component internally
                        }}
                        currentRowData={entPaginatedData}
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Search entitlements..."
                      className="border rounded px-3 py-2 w-64"
                      value={entitlementSearch}
                      onChange={(e) => {
                        setEntitlementSearch(e.target.value);
                        // Reset to page 1 when searching
                        setEntitlementsPageNumber(1);
                      }}
                    />
                    <Filters 
                      appliedFilter={handleAppliedFilter}
                      onFilterChange={handleAccountFilterChange}
                      context="status"
                      initialSelected="Pending"
                      value={selectedFilters.length > 0 ? selectedFilters[0] : undefined}
                      actionStates={actionStates}
                      statusCounts={statusCountsFromAccess}
                    />
                  </div>
                  {/* <div className="flex items-center gap-2">
                    <ColumnSettings
                      columnDefs={entitlementsColumnDefs}
                      gridApi={entitlementsGridApiRef.current}
                      visibleColumns={() => {
                        const visibleCols: string[] = [];
                        entitlementsColumnDefs.forEach((colDef) => {
                          if (colDef.field) {
                            visibleCols.push(colDef.field);
                          }
                        });
                        return visibleCols;
                      }}
                    />
                  </div> */}
                </div>
              </div>
            </div>
              </div>

              {/* AI Assist - Quick Wins - separate element, 1/3, same height as User card */}
              <div className="w-full lg:w-1/3 flex">
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-3 shadow-sm w-full h-full flex flex-col">
                  <div className="flex justify-between items-center gap-2 mb-3 flex-shrink-0">
                    <h2 className="text-sm font-medium text-gray-800">AI Assist - Quick Wins</h2>
                    <span className="flex-shrink-0 text-[10px] sm:text-xs font-semibold text-violet-900 bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-300/90 rounded-md px-2 py-0.5 shadow-sm">
                      Campaign Data Insights
                    </span>
                  </div>
                  <div className="flex flex-col gap-4 flex-1 min-h-0">
                    {/* Card 1 */}
                    <div
                      className={`relative flex-1 min-h-[5.5rem] cursor-pointer overflow-hidden rounded-lg border border-blue-200 bg-blue-50 shadow-sm ${
                        quickWinsApprovedCards.card1 ? "opacity-60" : ""
                      }`}
                      onMouseEnter={() => setGuidedPathHovered("card1")}
                      onMouseLeave={() =>
                        setGuidedPathHovered((prev) => (prev === "card1" ? null : prev))
                      }
                    >
                      {/* First page (default) */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                        <p className="text-base font-semibold text-blue-800">Speed</p>
                        <span className="mt-0.5 text-sm font-bold text-blue-600">46%</span>
                      </div>
                      {/* Second page content on hover with diagonal sweep from top-right to bottom-left */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        <div
                          className="w-full h-full flex flex-col justify-between px-3 py-2 text-white rounded-lg shadow-sm"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.9))",
                            transform:
                              guidedPathHovered === "card1"
                                ? "translate(0, 0)"
                                : "translate(120%, -120%)",
                            transition: "transform 0.5s ease-out",
                          }}
                        >
                          <p className="text-sm leading-snug">
                            Quick review of recommended access through peer analysis with 70% match.
                            Reduce effort by 3 hours.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              className="px-2 pt-0.5 pb-1 text-xs font-medium rounded bg-white/90 text-blue-700 pointer-events-auto"
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
                              className="px-2 pt-0.5 pb-1 text-xs font-medium rounded border border-white/80 text-white bg-transparent pointer-events-auto"
                              disabled={quickWinsApprovedCards.card1}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPeerReviewQuickWinModal("card1");
                              }}
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      </div>
                      {quickWinsApprovedCards.card1 && guidedPathHovered === "card1" && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                          <div className="flex items-center gap-2 text-xs font-medium text-white bg-black/50 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-4 h-4" />
                            <span>Already approved</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Card 2 */}
                    <div
                      className={`relative flex-1 min-h-[5.5rem] cursor-pointer overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm ${
                        quickWinsApprovedCards.card2 ? "opacity-60" : ""
                      }`}
                      onMouseEnter={() => setGuidedPathHovered("card2")}
                      onMouseLeave={() =>
                        setGuidedPathHovered((prev) => (prev === "card2" ? null : prev))
                      }
                    >
                      {/* First page (default) */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                        <p className="text-base font-semibold text-emerald-800">Low Risk</p>
                        <span className="mt-0.5 text-sm font-bold text-emerald-600">37%</span>
                      </div>
                      {/* Second page content on hover with diagonal sweep from top-right to bottom-left */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        <div
                          className="w-full h-full flex flex-col justify-between px-3 py-2 text-white rounded-lg shadow-sm"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(16, 185, 129, 0.9))",
                            transform:
                              guidedPathHovered === "card2"
                                ? "translate(0, 0)"
                                : "translate(120%, -120%)",
                            transition: "transform 0.5s ease-out",
                          }}
                        >
                          <p className="text-sm leading-snug">
                            Quick review of existing access approved in previous cycles with low
                            risk items. Reduce effort by 2 hours.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              className="px-2 pt-0.5 pb-1 text-xs font-medium rounded bg-white/90 text-emerald-700 pointer-events-auto"
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
                              className="px-2 pt-0.5 pb-1 text-xs font-medium rounded border border-white/80 text-white bg-transparent pointer-events-auto"
                              disabled={quickWinsApprovedCards.card2}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPeerReviewQuickWinModal("card2");
                              }}
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      </div>
                      {quickWinsApprovedCards.card2 && guidedPathHovered === "card2" && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                          <div className="flex items-center gap-2 text-xs font-medium text-white bg-black/50 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-4 h-4" />
                            <span>Already approved</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedUser && (
          <>
            {/* Entitlements Grid */}
            <div className=" min-w-0 w-full" ref={entitlementsGridContainerRef}>
              {loadingEntitlements ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-gray-500">
                    ⏳ Loading entitlements...
                  </div>
                </div>
              ) : filteredEntitlements.length > 0 ? (
                <>
                  {/* Pagination at top of table */}
                  <div className="flex justify-center [&>div]:rounded-b-none [&>div]:border-b-0 flex-shrink-0">
                    <CustomPagination
                      totalItems={entitlementsTotalItems}
                      currentPage={entitlementsPageNumber}
                      totalPages={entitlementsTotalPages}
                      pageSize={entitlementsPageSize}
                      onPageChange={handleEntitlementsPageChange}
                      onPageSizeChange={(newPageSize) => {
                        setEntitlementsPageSize(newPageSize);
                        setEntitlementsPageNumber(1); // Reset to first page when changing page size
                      }}
                      pageSizeOptions={pageSizeSelector}
                    />
                  </div>
                <div className="ag-theme-quartz w-full" style={{ width: '100%', maxWidth: '100%' }}>
                <AgGridReact
                  theme={themeQuartz}
                  rowData={entPaginatedData}
                  columnDefs={entitlementsColumnDefs}
                  defaultColDef={defaultColDef}
                  domLayout="autoHeight"
                  rowSelection={{ mode: "multiRow" }}
                  suppressSizeToFit={false}
                  style={{ width: '100%', minWidth: 0 }}
                  onGridReady={(params) => {
                    entitlementsGridApiRef.current = params.api;
                    // Don't resize here - let onFirstDataRendered handle it after data is loaded
                    // This prevents double resizing
                    const handleResize = () => {
                      // Only resize on window resize, not on initial load
                      if (!isInitialLoadRef.current && entitlementsGridApiRef.current) {
                        try {
                          entitlementsGridApiRef.current.sizeColumnsToFit();
                        } catch {}
                      }
                    };
                    window.addEventListener("resize", handleResize);
                    params.api.addEventListener('gridPreDestroyed', () => {
                      window.removeEventListener("resize", handleResize);
                    });
                  }}
                  onGridSizeChanged={(params) => {
                    try {
                      params.api.sizeColumnsToFit();
                    } catch {}
                  }}
                  isRowSelectable={(node) => !node?.data?.__isDescRow}
                  getRowId={(params: GetRowIdParams) => {
                    const baseId = params.data.lineItemId || params.data.accountLineItemId || params.data.taskId || `${params.data.applicationName}-${params.data.entitlementName}`;
                    return params.data.__isDescRow ? `${baseId}-desc` : baseId;
                  }}
                  getRowClass={(params) => params?.data?.__isDescRow ? "ag-row-custom ag-row-desc" : "ag-row-custom"}
                  onSelectionChanged={() => {
                    // Refresh cells to update Action column state when selection changes
                    if (entitlementsGridApiRef.current) {
                      // Use requestAnimationFrame to ensure the selection state is updated first
                      requestAnimationFrame(() => {
                        if (entitlementsGridApiRef.current) {
                          entitlementsGridApiRef.current.refreshCells({ force: true });
                        }
                      });
                    }
                  }}
                  onModelUpdated={(params) => {
                    // AG Grid's onModelUpdated fires when data model changes
                    // We can use this to detect when rendering is complete
                    // But don't resize here - let onFirstDataRendered handle it
                  }}
                  onFirstDataRendered={(params) => {
                    // Auto-size columns after data is rendered - only once per unique data set
                    // Use ref to get current data reliably
                    const currentData = currentPaginatedDataRef.current;
                    const currentSignature = getDataSignature(currentData);
                    
                    // Skip if we've already resized for this exact data set
                    if (lastResizedDataSignatureRef.current === currentSignature) {
                      return;
                    }
                    if (resizeBlockedRef.current) {
                      return;
                    }
                    if (isDataLoadingRef.current) {
                      return;
                    }
                    
                    // Block further resizes temporarily
                    resizeBlockedRef.current = true;
                    
                    requestAnimationFrame(() => {
                      setTimeout(() => {
                        if (entitlementsGridContainerRef.current && params.api) {
                          const containerWidth = entitlementsGridContainerRef.current.offsetWidth || entitlementsGridContainerRef.current.clientWidth;
                          if (containerWidth > 0) {
                            try {
                              params.api.sizeColumnsToFit();
                              lastResizedDataSignatureRef.current = currentSignature;
                              // Mark initial load as complete after first resize
                              if (isInitialLoadRef.current) {
                                isInitialLoadRef.current = false;
                              }
                              // Unblock after resize completes
                              setTimeout(() => {
                                resizeBlockedRef.current = false;
                              }, 150);
                            } catch {
                              resizeBlockedRef.current = false;
                            }
                          } else {
                            // Retry if container doesn't have width yet
                            setTimeout(() => {
                              try {
                                const retrySignature = getDataSignature(currentPaginatedDataRef.current);
                                if (params.api && lastResizedDataSignatureRef.current !== retrySignature) {
                                  params.api.sizeColumnsToFit();
                                  lastResizedDataSignatureRef.current = retrySignature;
                                }
                                resizeBlockedRef.current = false;
                              } catch {
                                resizeBlockedRef.current = false;
                              }
                            }, 300);
                          }
                        } else {
                          resizeBlockedRef.current = false;
                        }
                      }, 300);
                    });
                  }}
                  pagination={false}
                  overlayLoadingTemplate={`<span class="ag-overlay-loading-center">⏳ Loading entitlements...</span>`}
                  overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">All entitlements have been reviewed for this user.</span>`}
                  className="ag-main"
                />
                </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-gray-500">
                    No entitlements found for this user.
                  </div>
                </div>
              )}
            </div>

            {/* Pagination at bottom of table */}
            {filteredEntitlements.length > 0 && (
              <div className="">
                <div className="flex justify-center [&>div]:rounded-t-none [&>div]:border-t-0">
                  <CustomPagination
                    totalItems={entitlementsTotalItems}
                    currentPage={entitlementsPageNumber}
                    totalPages={entitlementsTotalPages}
                    pageSize={entitlementsPageSize}
                    onPageChange={handleEntitlementsPageChange}
                    onPageSizeChange={(newPageSize) => {
                      setEntitlementsPageSize(newPageSize);
                      setEntitlementsPageNumber(1); // Reset to first page when changing page size
                    }}
                    pageSizeOptions={pageSizeSelector}
                  />
                </div>
              </div>
            )}
          </>
        )}
        
        {!selectedUser && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select a User</h3>
              <p>Choose a user from the sidebar to view their entitlements</p>
            </div>
          </div>
        )}
      </div>
      {/* AI Assist - Quick Wins modal for Dormant / Access table */}
      {guidedPathModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div
            className="bg-white rounded-lg shadow-xl mx-auto flex flex-col min-h-0 w-[92vw] max-w-[1600px] shrink-0"
            style={{ height: "92vh", minHeight: "78vh", maxHeight: "96vh" }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
                <span>AI Assist - Quick Wins</span>
                <span className="text-[10px] font-semibold text-violet-900 bg-violet-100 border border-violet-300 rounded px-1.5 py-0.5">
                  Sample data
                </span>
                {guidedPathModalSource !== "speedPeer" && (
                  <>
                    {" "}
                    - {guidedPathModalFilter === "Dormant" ? "Dormant Accounts" : "All Access"}
                  </>
                )}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                onClick={() => {
                  setGuidedPathModalOpen(false);
                  setGuidedPathModalSource("entitlements");
                  setPeerQuickWinReviewSource(null);
                  setSpeedPeerModalSearch("");
                  setSpeedPeerInsightDetail(null);
                  setGuidedPathModalPageNumber(1);
                  setGuidedPathModalPageSize(10);
                  guidedPathGridApiRef.current?.deselectAll();
                }}
              >
                ×
              </button>
            </div>
            <div
              className={`flex items-center gap-2 px-4 py-2 shrink-0 ${
                guidedPathModalSource === "speedPeer" ? "" : "border-b"
              }`}
            >
              {guidedPathModalSource === "entitlements" ? (
                <>
                  <span className="text-xs font-medium text-gray-500">Filter:</span>
                  <button
                    className={`px-3 py-1 text-xs rounded-full border ${
                      guidedPathModalFilter === "Dormant"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300"
                    }`}
                    onClick={() => {
                      guidedPathGridApiRef.current?.deselectAll();
                      setGuidedPathModalFilter("Dormant");
                    }}
                  >
                    Dormant Accounts
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-full border ${
                      guidedPathModalFilter === "Access"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300"
                    }`}
                    onClick={() => {
                      guidedPathGridApiRef.current?.deselectAll();
                      setGuidedPathModalFilter("Access");
                    }}
                  >
                    All Access
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium text-gray-500 shrink-0">Search:</span>
                  <input
                    type="text"
                    placeholder="Search entitlements..."
                    className="border border-gray-300 rounded px-3 py-2 text-xs flex-1 min-w-0 max-w-md"
                    value={speedPeerModalSearch}
                    onChange={(e) => setSpeedPeerModalSearch(e.target.value)}
                  />
                </>
              )}
              <button
                className="ml-auto px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                disabled={
                  guidedPathModalSource === "speedPeer"
                    ? speedPeerTaskRowsLoading ||
                      (peerQuickWinReviewSource === "card2"
                        ? quickWinsApprovedCards.card2
                        : quickWinsApprovedCards.card1)
                    : quickWinsApprovedCards.card2
                }
                onClick={() => {
                  setQuickWinsPendingCard(
                    guidedPathModalSource === "speedPeer"
                      ? peerQuickWinReviewSource === "card2"
                        ? "card2"
                        : "card1"
                      : "card2"
                  );
                  setQuickWinsApproveConfirmOpen(true);
                }}
              >
                Approve All
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 px-4 py-3 overflow-hidden relative">
              {guidedPathModalSource === "speedPeer" && speedPeerTaskRowsLoading ? (
                <div className="text-xs text-gray-500 py-6 text-center">Loading task details…</div>
              ) : guidedPathModalSource === "speedPeer" && speedPeerTaskRowsError ? (
                <div className="text-xs text-red-600 py-6 text-center">{speedPeerTaskRowsError}</div>
              ) : guidedPathModalRowsForGrid.length === 0 ? (
                <div className="text-xs text-gray-500 py-6 text-center">
                  {guidedPathModalSource === "speedPeer"
                    ? speedPeerModalSearch.trim() && speedPeerTaskRows.length > 0
                      ? "No rows match your search."
                      : "No rows returned from executeQuery for this peer match."
                    : "No data available for the selected filter."}
                </div>
              ) : (
                <>
                  <div className="flex justify-center shrink-0 mb-2 [&>div]:w-full [&>div]:rounded-b-none [&>div]:border-b-0">
                    <CustomPagination
                      totalItems={guidedPathModalRowsForGrid.length}
                      currentPage={guidedPathModalPageNumber}
                      totalPages={guidedPathModalTotalPages}
                      pageSize={guidedPathModalPageSize}
                      onPageChange={setGuidedPathModalPageNumber}
                      onPageSizeChange={(newSize) => {
                        setGuidedPathModalPageSize(newSize);
                        setGuidedPathModalPageNumber(1);
                      }}
                      pageSizeOptions={[...pageSizeSelector, "all"]}
                    />
                  </div>
                  <div className="ag-theme-quartz w-full flex-1 min-h-[52vh] overflow-auto">
                    <AgGridReact
                      theme={themeQuartz}
                      rowData={guidedPathModalPagedRows}
                      columnDefs={guidedPathModalGridColumnDefs}
                      defaultColDef={defaultColDef}
                      domLayout="autoHeight"
                      suppressSizeToFit={false}
                      style={{ width: "100%", minWidth: 0 }}
                      onGridReady={(params) => {
                        guidedPathGridApiRef.current = params.api;
                        try {
                          params.api.sizeColumnsToFit();
                        } catch {}
                      }}
                      onGridSizeChanged={(params) => {
                        try {
                          params.api.sizeColumnsToFit();
                        } catch {}
                      }}
                      getRowId={(params: GetRowIdParams) => {
                        if (guidedPathModalSource === "speedPeer") {
                          const d = params.data as Record<string, unknown>;
                          const id =
                            d?.taskid ??
                            d?.task_id ??
                            d?.TaskId ??
                            d?.taskId ??
                            d?.lineitemid ??
                            d?.line_item_id ??
                            d?.id;
                          if (id != null && String(id).trim() !== "") {
                            return `eq-${String(id)}`;
                          }
                          const u = d?.user_displayname;
                          const ix = d?.insight_index;
                          if (u != null || ix != null) {
                            return `eq-sp-${String(u ?? "")}-${String(ix ?? params.node?.rowIndex ?? 0)}`;
                          }
                          return `eq-idx-${params.node?.rowIndex ?? 0}`;
                        }
                        const baseId =
                          params.data.lineItemId ||
                          params.data.accountLineItemId ||
                          params.data.taskId ||
                          `${params.data.applicationName}-${params.data.entitlementName}`;
                        return params.data.__isDescRow ? `${baseId}-desc` : baseId;
                      }}
                      getRowClass={(params) =>
                        params?.data?.__isDescRow ? "ag-row-custom ag-row-desc" : "ag-row-custom"
                      }
                      pagination={false}
                      overlayLoadingTemplate={`<span class="ag-overlay-loading-center">⏳ Loading entitlements...</span>`}
                      overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No entitlements found for this filter.</span>`}
                      className="ag-main"
                    />
                  </div>
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

      <DelegateActionModal
        isModalOpen={isDelegateModalOpen}
        closeModal={() => setIsDelegateModalOpen(false)}
        heading="Delegate"
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
        onSelectDelegate={() => {
          setIsDelegateModalOpen(false);
        }}
      />
      <ProxyActionModal
        isModalOpen={isReassignModalOpen}
        closeModal={() => setIsReassignModalOpen(false)}
        heading="Reassign"
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
        onSelectOwner={async (owner) => {
          try {
            // Determine owner type and ID
            const ownerType = owner.username ? "User" : "Group";
            const ownerId = owner.id || (ownerType === "User" ? (owner.username || owner.email || "") : (owner.name || ""));

            // Get taskId from selectedUser if available, otherwise use empty string
            const taskId = selectedUser?.taskId || "";

            // For User assignment entity, use userId as lineItemId
            const lineItemId = selectedUser?.id || selectedUser?.userid || "";

            // Construct the payload
            const payload = {
              reviewerName: selectedUser?.fullName || selectedUser?.username || reviewerId || "",
              reviewerId: reviewerId,
              certificationId: certId,
              taskId: taskId,
              lineItemId: lineItemId,
              assignmentEntity: "User",
              newOwnerDetails: {
                id: ownerId,
                type: ownerType,
              },
              justification: "Reassignment requested", // Default justification
            };

            // Make the API call
            const response = await fetch(
              `https://preview.keyforge.ai/certification/api/v1/ACMECOM/reassign/${reviewerId}/${certId}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              }
            );

            if (!response.ok) {
              throw new Error(`Reassign failed: ${response.statusText}`);
            }

            // Success
            setIsReassignModalOpen(false);
            
            // Optionally refresh the data
            refetchUsers();
          } catch (error) {
            console.error("Error reassigning certification:", error);
            alert(`Failed to reassign: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }}
      />
    </div>
  );
};

export default TreeClient;

