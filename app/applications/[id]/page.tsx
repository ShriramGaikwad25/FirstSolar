"use client";
import Accordion from "@/components/Accordion";
import ChartComponent from "@/components/ChartComponent";
import HorizontalTabs from "@/components/HorizontalTabs";
import {
  ColDef,
  GridApi,
  ICellRendererParams,
  IDetailCellRendererParams,
} from "ag-grid-enterprise";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CircleCheck,
  CircleX,
  ArrowRightCircle,
  ArrowRight,
  X,
  Edit,
  Plus,
  Trash2,
  Info,
  HelpCircle,
  Search,
  Printer,
} from "lucide-react";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { formatDateMMDDYY } from "@/utils/utils";
import "@/lib/ag-grid-setup";
import Exports from "@/components/agTable/Exports";
import CustomPagination from "@/components/agTable/CustomPagination";
import EditReassignButtons from "@/components/agTable/EditReassignButtons";
import ActionButtons from "@/components/agTable/ActionButtons";
import { getAllRegisteredApps, searchUsers } from "@/lib/api";
import { getReviewerId, getCookie, COOKIE_NAMES } from "@/lib/auth";
import { getOriginalFetch } from "@/lib/authFetch";
import Link from "next/link";
import Tabs from "@/components/tabs";
import PolicyRiskDetails from "@/components/PolicyRiskDetails";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import UserDisplayName from "@/components/UserDisplayName";

/** First path segment for catalog mapping API (Keyforge / ACMECOM). */
const CATALOG_MAPPING_SCOPE_ID = "11111111-1111-1111-1111-111111111111";

function pickString(...vals: Array<unknown | undefined | null>): string | undefined {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return undefined;
}

/** Entitlement display name for client-side filtering (API shapes vary). */
function getEntitlementNameForFilter(row: any): string {
  if (!row || typeof row !== "object") return "";
  const c = row.catalogDetails;
  return (
    pickString(
      row.entitlementName,
      row.name,
      row["Ent Name"],
      c?.name,
      c?.entitlementName,
      c?.entitlement_name
    ) ?? ""
  );
}

/** Resolve catalog id from an entitlement row (API shapes vary by endpoint). */
function resolveCatalogIdFromEntitlementRow(row: any): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const c = row.catalogDetails;
  return pickString(
    row.__catalogIdForMapping,
    row.catalogid,
    row.catalogId,
    row.catalog_id,
    row.CatalogId,
    c?.id,
    c?.catalogid,
    c?.catalogId,
    c?.catalog_id,
    c?.Id,
    row.entitlementCatalogId,
    row.entCatalogId,
    row.catalogID,
    c?.catalogID,
    row.entitlementId,
    c?.entitlementid,
    c?.entitlementId
  );
}

/** Entitlement id for `kf_entitlement_assignment_v` (may differ from catalog id). */
function resolveEntitlementIdForAssignmentQuery(row: any): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const c = row.catalogDetails;
  return pickString(
    row.entitlementId,
    row.entitlementid,
    row["Ent ID"],
    c?.entitlementid,
    c?.entitlementId,
    c?.id,
    row.id
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractExecuteQueryRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const tryKeys = ["resultSet", "rows", "data", "items", "records", "result"];
  for (const k of tryKeys) {
    const v = o[k];
    if (Array.isArray(v) && v.length) return v as Record<string, unknown>[];
  }
  const dataObj = o.data;
  if (dataObj && typeof dataObj === "object" && !Array.isArray(dataObj)) {
    for (const k of tryKeys) {
      const v = (dataObj as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length) return v as Record<string, unknown>[];
    }
  }
  return [];
}

function pickAssignmentLabel(row: Record<string, unknown>): string {
  const s = pickString(
    row.memberof as string | undefined,
    row.member_of as string | undefined,
    row.assignedto as string | undefined,
    row.assigned_to as string | undefined,
    row.memberto as string | undefined,
    row.member_to as string | undefined,
    row.principalname as string | undefined,
    row.principal_name as string | undefined,
    row.displayname as string | undefined,
    row.display_name as string | undefined,
    row.accountname as string | undefined,
    row.groupname as string | undefined,
    row.name as string | undefined
  );
  if (s) return s;
  for (const v of Object.values(row)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return "—";
}

function extractMappingRowsFromResponse(json: unknown): Record<string, unknown>[] {
  if (json == null) return [];
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (typeof json !== "object") return [];

  const o = json as Record<string, unknown>;

  if (o.executionStatus && String(o.executionStatus).toLowerCase() !== "success") {
    return [];
  }

  const tryKeys = [
    "resultSet",
    "items",
    "data",
    "result",
    "mappings",
    "records",
    "rows",
    "values",
    "content",
    "payload",
  ];
  for (const k of tryKeys) {
    const v = o[k];
    if (Array.isArray(v) && v.length) return v as Record<string, unknown>[];
  }
  const dataObj = o.data;
  if (dataObj && typeof dataObj === "object" && !Array.isArray(dataObj)) {
    for (const k of tryKeys) {
      const v = (dataObj as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length) return v as Record<string, unknown>[];
    }
  }
  for (const v of Object.values(o)) {
    if (Array.isArray(v) && v.length > 0 && v[0] != null && typeof v[0] === "object") {
      return v as Record<string, unknown>[];
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(o, "mapped_item_name") ||
    Object.prototype.hasOwnProperty.call(o, "mapped_applicationname") ||
    Object.prototype.hasOwnProperty.call(o, "mappedItemName") ||
    Object.prototype.hasOwnProperty.call(o, "mappedApplicationname") ||
    Object.prototype.hasOwnProperty.call(o, "catalog_item_name") ||
    Object.prototype.hasOwnProperty.call(o, "source_applicationname")
  ) {
    return [o];
  }
  return [];
}

function pickMappedItemField(row: any): string {
  if (row == null || typeof row !== "object") return "—";
  const nested = (row as any).mapping;
  const src = nested && typeof nested === "object" ? { ...row, ...nested } : row;
  return pickString(
    src.mapped_item_name,
    src.mappedItemName,
    src.mappedItem,
    (src as any).Mapped_Item_Name,
    (src as any).MAPPED_ITEM_NAME,
    src.catalog_item_name,
    src.catalogItemName
  ) ?? "—";
}

function pickMappedAppField(row: any): string {
  if (row == null || typeof row !== "object") return "—";
  const nested = (row as any).mapping;
  const src = nested && typeof nested === "object" ? { ...row, ...nested } : row;
  return pickString(
    src.mapped_applicationname,
    src.mappedApplicationname,
    src.mappedApplicationName,
    src.mapped_app_name,
    (src as any).Mapped_Applicationname,
    src.source_applicationname,
    src.sourceApplicationname
  ) ?? "—";
}

/** True if the row has a non-empty mapping id (API `mapping_id` / `id` / etc.). */
function rowHasMappingId(row: unknown): boolean {
  return Boolean(pickMappingIdFromRow(row));
}

/** Keyforge mapping record id (for DELETE .../remove with mappingIds body). */
function pickMappingIdFromRow(row: any): string | undefined {
  if (row == null || typeof row !== "object") return undefined;
  const nested = (row as any).mapping;
  const m = nested && typeof nested === "object" ? nested : null;
  return pickString(
    (row as any).__mappingId,
    (row as any).mappingId,
    (row as any).mappingid,
    (row as any).mapping_id,
    (row as any).MappingId,
    (row as any).mapid,
    m?.id,
    m?.mappingId,
    (row as any).id
  );
}

function extractNewMappingIdsFromAddResponse(data: unknown, count: number): (string | undefined)[] {
  const out: (string | undefined)[] = Array.from({ length: count }, () => undefined);
  if (data == null || typeof data !== "object") return out;
  const o = data as Record<string, unknown>;
  const arr = (Array.isArray(o.resultSet) && o.resultSet) ||
    (Array.isArray(o.mappings) && o.mappings) ||
    (Array.isArray(o.items) && o.items) ||
    (o.data && typeof o.data === "object" && Array.isArray((o.data as any).resultSet) && (o.data as any).resultSet) ||
    null;
  if (Array.isArray(arr) && arr.length) {
    for (let i = 0; i < Math.min(arr.length, count); i++) {
      const item = arr[i];
      if (item && typeof item === "object") {
        out[i] = pickString(
          (item as any).mappingId,
          (item as any).id,
          (item as any).mapping_id
        );
      }
    }
    return out;
  }
  const single = pickString(
    o.mappingId as string | undefined,
    o.id as string | undefined
  );
  if (single) out[0] = single;
  return out;
}

/** Stable id for an entitlement row from getAppEntitlements (used for selection keys). */
function getAccessItemKey(item: any, listIndex: number) {
  const c = item?.catalogDetails;
  const k = pickString(
    c?.id,
    item.entitlementId,
    item.id,
    item.catalogid,
    item.catalogId
  );
  if (k) return k;
  return `access-row-${listIndex}`;
}

function getTargetCatalogIdFromAccessItem(item: any): string | undefined {
  const c = item?.catalogDetails;
  return pickString(
    c?.id,
    c?.catalogid,
    c?.catalogId,
    item.catalogid,
    item.catalogId,
    item.entitlementId,
    item.id
  );
}

/** One entry for POST .../mapping/{scope}/{catalogId}/add (per Keyforge body shape). */
function buildMappingEntryFromAccessItem(
  item: any,
  appInstanceId: string
):
  | {
      appinstanceid: string;
      applicationname: string;
      catalogid: string;
      catalogIdType: string;
      mappingDescription: string;
      attributes: Record<string, unknown>;
    }
  | undefined {
  const catalogid = getTargetCatalogIdFromAccessItem(item);
  if (!catalogid) return undefined;
  const c = item?.catalogDetails;
  const applicationname =
    pickString(
      item.applicationName,
      item["App Name"],
      item.applicationname,
      item.appName,
      c?.applicationname,
      c?.applicationName,
      c?.appName
    ) ?? "";
  const catalogIdType =
    pickString(
      c?.catalogIdType,
      c?.catalogidtype,
      item.catalogIdType,
      item.catalogIDType
    ) ?? "Group";
  const mappingDescription =
    pickString(
      c?.mappingDescription,
      c?.description,
      c?.entitlementDescription,
      c?.longDescription,
      item.entitlementDescription,
      item["Ent Description"],
      item.description
    ) ?? "";
  const rawAttrs = c?.attributes;
  const attributes =
    rawAttrs && typeof rawAttrs === "object" && !Array.isArray(rawAttrs)
      ? (rawAttrs as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return {
    appinstanceid: appInstanceId,
    applicationname,
    catalogid,
    catalogIdType,
    mappingDescription,
    attributes,
  };
}

interface DataItem {
  label: string;
  value: number;
  color?: string;
}

const data: Record<string, DataItem[]> = {
  accountSummary: [
    { label: "Regular Accounts", value: 0 },
    { label: "Elevated Accounts", value: 0 },
    { label: "Orphan Accounts", value: 0 },
    { label: "Terminated User Accounts", value: 0 },
  ],
  accountActivity: [
    { label: "Active in past 30 days", value: 0 },
    { label: "Dormant for past 30-60 days", value: 0 },
    { label: "Dormant for more than 90 days", value: 0 },
  ],
  changeSinceLastReview: [
    { label: "New accounts", value: 0 },
    { label: "Old accounts", value: 0 },
    { label: "New entitlements", value: 0 },
  ],
};

const dataAccount: Record<string, DataItem[]> = {
  accountSummary: [
    { label: "Regular Accounts", value: 0 },
    { label: "Elevated Accounts", value: 0 },
    { label: "Orphan Accounts", value: 0 },
    { label: "Terminated User Accounts", value: 0 },
  ],
  accountActivity: [
    { label: "Active in past 30 days", value: 0 },
    { label: "Dormant for past 30-60 days", value: 0 },
    { label: "Dormant for more than 90 days", value: 0 },
  ],
};

export default function ApplicationDetailPage() {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const reviewerId = getReviewerId() || "";
  
  // Wrapper function to handle page changes and close sidebar
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    closeSidebar();
  };
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id as string;
  const [tabIndex, setTabIndex] = useState(1);
  const [entTabIndex, setEntTabIndex] = useState(1); // Set to 1 for "Under Review"
  const gridApiRef = useRef<GridApi | null>(null);
  const [selected, setSelected] = useState<{ [key: string]: number | null }>(
    {}
  );
  const [mounted, setMounted] = useState(false);
  const [nodeData, setNodeData] = useState<any>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<any>(null);
  const [expandedFrames, setExpandedFrames] = useState({
    general: false,
    business: false,
    technical: false,
    security: false,
    lifecycle: false,
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableNodeData, setEditableNodeData] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [comment, setComment] = useState("");
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [accountsRowData, setAccountsRowData] = useState<any[]>([]);
  const [filteredAccountsRowData, setFilteredAccountsRowData] = useState<any[]>([]);
  const [accountsSearchQuery, setAccountsSearchQuery] = useState("");
  const accountsSearchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [accountsTabIndex, setAccountsTabIndex] = useState(0); // 0 for All, 1 for Service Accounts
  const [serviceAccountsRowData, setServiceAccountsRowData] = useState<any[]>([]);
  const [filteredServiceAccountsRowData, setFilteredServiceAccountsRowData] = useState<any[]>([]);
  const [serviceAccountsSearchQuery, setServiceAccountsSearchQuery] = useState("");
  const serviceAccountsSearchInputRef = useRef<HTMLInputElement>(null);
  const serviceAccountsGridApiRef = useRef<GridApi | null>(null);
  const [entRowData, setEntRowData] = useState<any[]>([]);
  const [entitlementsSearchQuery, setEntitlementsSearchQuery] = useState("");
  const entitlementsSearchInputRef = useRef<HTMLInputElement>(null);
  const [isEntitlementsSearchFocused, setIsEntitlementsSearchFocused] =
    useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [entitlementDetails, setEntitlementDetails] = useState<any>(null);
  const [entitlementDetailsError, setEntitlementDetailsError] = useState<
    string | null
  >(null);

  // Attribute mapping pagination state
  const [attributeMappingPage, setAttributeMappingPage] = useState(1);
  const [activeMappingTab, setActiveMappingTab] = useState("provisioning");
  const [isEditingAttribute, setIsEditingAttribute] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<any>(null);
  const [isAttributeMappingExpanded, setIsAttributeMappingExpanded] =
    useState(false);
  const [isHookExpanded, setIsHookExpanded] = useState(true);
  const [activeEventTab, setActiveEventTab] = useState("pre-process");
  const [activeOperation, setActiveOperation] = useState("create");
  const [activeSDKOperation, setActiveSDKOperation] = useState("create");
  const [isServiceExpanded, setIsServiceExpanded] = useState(true);
  const [isSDKExpanded, setIsSDKExpanded] = useState(true);
  const [isThresholdExpanded, setIsThresholdExpanded] = useState(true);
  const [hookName, setHookName] = useState("");

  // Attribute mapping data
  type AttributeMapping = { source: string; target: string; defaultValue?: string };
  const [attributeMappingData, setAttributeMappingData] = useState<{
    provisioning: Record<number, AttributeMapping[]>;
    reconciliation: Record<number, AttributeMapping[]>;
  }>({ provisioning: {}, reconciliation: {} });
  const ATTR_MAPPING_PAGE_SIZE = 10;

  // Fetch schema mapping from Keyforge and populate attribute mappings
  useEffect(() => {
    try {
      const applicationID = localStorage.getItem("keyforgeApplicationID");
      if (!applicationID) return;
      const url = `https://preview.keyforge.ai/schemamapper/getmappedschema/ACMECOM/${encodeURIComponent(
        applicationID
      )}`;
      (async () => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) return;
          const json = await resp.json();
          const provisioningMap = json?.provisioningAttrMap?.scimTargetMap || {};
          const reconciliationMap = json?.reconcilliationAttrMap?.scimTargetMap || {};

          // For provisioning: keys are target attributes, values.variable are source attributes
          const provisioningList: AttributeMapping[] = Object.entries(provisioningMap).map(
            ([target, value]: any) => ({
              source: (value?.variable ?? "").toString(),
              target: target.toString(),
            })
          );

          // For reconciliation: keys are source attributes, values.variable are target attributes
          const reconciliationList: AttributeMapping[] = Object.entries(reconciliationMap).map(
            ([source, value]: any) => ({
              source: source.toString(),
              target: (value?.variable ?? "").toString(),
            })
          );

          setAttributeMappingData({
            provisioning: { 1: provisioningList },
            reconciliation: { 1: reconciliationList },
          });
        } catch {
          // ignore schema fetch errors for now
        }
      })();
    } catch {
      // localStorage not available
    }
  }, []);

  const getCurrentPageData = (): AttributeMapping[] => {
    const tabKey = (activeMappingTab as unknown) as "provisioning" | "reconciliation";
    const tabData = attributeMappingData[tabKey] || {};
    const fullList: AttributeMapping[] = Object.values(tabData).flat() as AttributeMapping[];
    const start = (attributeMappingPage - 1) * ATTR_MAPPING_PAGE_SIZE;
    const end = start + ATTR_MAPPING_PAGE_SIZE;
    return fullList.slice(start, end);
  };

  const getAttributeMappingTotalPages = (): number => {
    const tabKey = (activeMappingTab as unknown) as "provisioning" | "reconciliation";
    const tabData = attributeMappingData[tabKey] || {};
    const fullList: AttributeMapping[] = Object.values(tabData).flat() as AttributeMapping[];
    return Math.max(1, Math.ceil(fullList.length / ATTR_MAPPING_PAGE_SIZE));
  };

  // Pagination state for Entitlement tab tables
  const [entCurrentPage, setEntCurrentPage] = useState(1);
  const [entPageSize, setEntPageSize] = useState(20);
  const [entTotalItems, setEntTotalItems] = useState(0);
  const [entTotalPages, setEntTotalPages] = useState(0);

  const filteredEntRowData = useMemo(() => {
    const q = entitlementsSearchQuery.trim().toLowerCase();
    const base = !q
      ? entRowData
      : entRowData.filter((row: any) => {
          const name = getEntitlementNameForFilter(row);
          return name.toLowerCase().includes(q);
        });
    return [...base].sort((a: any, b: any) =>
      String(b?.["Ent Owner"] ?? "").localeCompare(String(a?.["Ent Owner"] ?? ""))
    );
  }, [entRowData, entitlementsSearchQuery]);

  // Build separate row for description under each entitlement row (for Entitlements tab)
  const entRowsWithDesc = useMemo(() => {
    if (!filteredEntRowData || filteredEntRowData.length === 0) return [] as any[];
    const rows: any[] = [];
    for (const item of filteredEntRowData) {
      rows.push(item);
      rows.push({ ...item, __isDescRow: true });
    }
    return rows;
  }, [filteredEntRowData]);

  // Paginated data for Entitlement tab tables
  const entPaginatedData = useMemo(() => {
    // Since entRowsWithDesc is structured as [record1, desc1, record2, desc2, ...]
    // We need to slice by pairs: each record has its description right after it

    // Calculate the start and end indices for the entRowsWithDesc array
    // Each "page" contains entPageSize records, which means entPageSize * 2 rows total
    const startIndex = (entCurrentPage - 1) * entPageSize * 2;
    const endIndex = startIndex + entPageSize * 2;

    return entRowsWithDesc.slice(startIndex, endIndex);
  }, [entRowsWithDesc, entCurrentPage, entPageSize]);

  // Update total items and pages when entRowsWithDesc changes
  useEffect(() => {
    // Only count actual data rows, not description rows
    const actualDataRows = entRowsWithDesc.filter((row) => !row.__isDescRow);
    setEntTotalItems(actualDataRows.length);
    setEntTotalPages(Math.ceil(actualDataRows.length / entPageSize));
  }, [entRowsWithDesc, entPageSize]);

  // Reset pagination when switching between entitlement tabs
  useEffect(() => {
    setEntCurrentPage(1);
  }, [entTabIndex]);

  useEffect(() => {
    setEntCurrentPage(1);
  }, [entitlementsSearchQuery]);

  useEffect(() => {
    if (isEntitlementsSearchFocused && entitlementsSearchInputRef.current) {
      requestAnimationFrame(() => {
        entitlementsSearchInputRef.current?.focus();
        const input = entitlementsSearchInputRef.current;
        if (input && input.selectionStart !== null) {
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      });
    }
  }, [filteredEntRowData, isEntitlementsSearchFocused]);

  // Helper function to map catalogDetails to nodeData fields
  const mapApiDataToNodeData = (catalogDetails: any, originalNodeData: any) => {
    if (!catalogDetails) return originalNodeData;

    // Create a mapping object that handles various possible field names
    const fieldMappings = {
      // Entitlement basic info
      "Ent Name":
        catalogDetails.name ||
        catalogDetails.entitlementName ||
        catalogDetails.entitlement_name ||
        originalNodeData?.["Ent Name"],
      "Ent Description":
        catalogDetails.description ||
        catalogDetails.entitlementDescription ||
        catalogDetails.entitlement_description ||
        originalNodeData?.["Ent Description"],
      "Ent Type":
        catalogDetails.type ||
        catalogDetails.entitlementType ||
        catalogDetails.entitlement_type ||
        originalNodeData?.["Ent Type"],

      // Application info
      "App Name":
        catalogDetails.applicationname ||
        catalogDetails.appName ||
        catalogDetails.application_name ||
        originalNodeData?.["App Name"],
      "App Instance":
        catalogDetails.appInstanceId ||
        catalogDetails.appinstanceid ||
        catalogDetails.applicationInstanceId ||
        originalNodeData?.["App Instance"],
      "App Owner":
        catalogDetails.applicationOwner ||
        catalogDetails.applicationowner ||
        catalogDetails.app_owner ||
        originalNodeData?.["App Owner"],
      "Ent Owner":
        catalogDetails.entitlementOwner ||
        catalogDetails.entitlementowner ||
        catalogDetails.entitlement_owner ||
        originalNodeData?.["Ent Owner"],

      // Business info
      "Business Objective":
        catalogDetails.businessObjective ||
        catalogDetails.business_objective ||
        catalogDetails.businessObjective ||
        originalNodeData?.["Business Objective"],
      "Business Unit":
        catalogDetails.businessUnit ||
        catalogDetails.businessunit_department ||
        catalogDetails.business_unit ||
        originalNodeData?.["Business Unit"],
      "Compliance Type":
        catalogDetails.complianceType ||
        catalogDetails.regulatory_scope ||
        catalogDetails.compliance_type ||
        originalNodeData?.["Compliance Type"],
      "Data Classification":
        catalogDetails.dataClassification ||
        catalogDetails.data_classification ||
        catalogDetails.data_classification ||
        originalNodeData?.["Data Classification"],
      "Cost Center":
        catalogDetails.costCenter ||
        catalogDetails.cost_center ||
        catalogDetails.cost_center ||
        originalNodeData?.["Cost Center"],

      // Dates
      "Created On":
        catalogDetails.createdOn ||
        catalogDetails.created_on ||
        catalogDetails.createdOn ||
        originalNodeData?.["Created On"],
      "Last Sync":
        catalogDetails.lastSync ||
        catalogDetails.last_sync ||
        catalogDetails.lastSync ||
        originalNodeData?.["Last Sync"],
      "Last Reviewed on":
        catalogDetails.lastReviewedOn ||
        catalogDetails.last_reviewed_on ||
        catalogDetails.lastReviewedOn ||
        originalNodeData?.["Last Reviewed on"],

      // Technical details
      "Logical Application":
        catalogDetails.logicalApplication ||
        catalogDetails.logical_application ||
        catalogDetails.logicalApp ||
        originalNodeData?.["Logical Application"],
      "Application Category":
        catalogDetails.applicationCategory ||
        catalogDetails.application_category ||
        catalogDetails.appCategory ||
        originalNodeData?.["Application Category"],
      "Associated Access":
        catalogDetails.associatedAccess ||
        catalogDetails.associated_access ||
        originalNodeData?.["Associated Access"],
      Hierarchy:
        catalogDetails.hierarchy ||
        catalogDetails.hierarchy ||
        originalNodeData?.["Hierarchy"],
      "MFA Status":
        catalogDetails.mfaStatus ||
        catalogDetails.mfa_status ||
        catalogDetails.mfaStatus ||
        originalNodeData?.["MFA Status"],
      assignment:
        catalogDetails.assignment ||
        catalogDetails.assigned_to ||
        catalogDetails.assignment ||
        originalNodeData?.["assignment"],
      "License Type":
        catalogDetails.licenseType ||
        catalogDetails.license_type ||
        catalogDetails.licenseType ||
        originalNodeData?.["License Type"],

      // Risk and security
      Risk:
        catalogDetails.risk ||
        catalogDetails.riskLevel ||
        catalogDetails.risk ||
        originalNodeData?.["Risk"],
      Certifiable:
        catalogDetails.certifiable ||
        catalogDetails.certifiable ||
        originalNodeData?.["Certifiable"],
      "Revoke on Disable":
        catalogDetails.revokeOnDisable ||
        catalogDetails.revoke_on_disable ||
        catalogDetails.revokeOnDisable ||
        originalNodeData?.["Revoke on Disable"],
      "Shared Pwd":
        catalogDetails.sharedPassword ||
        catalogDetails.shared_pwd ||
        catalogDetails.sharedPassword ||
        originalNodeData?.["Shared Pwd"],
      "SOD Check":
        catalogDetails.sodCheck ||
        catalogDetails.toxic_combination ||
        catalogDetails.sodCheck ||
        originalNodeData?.["SOD Check"],
      "Access Scope":
        catalogDetails.accessScope ||
        catalogDetails.access_scope ||
        catalogDetails.accessScope ||
        originalNodeData?.["Access Scope"],
      "Review Schedule":
        catalogDetails.reviewSchedule ||
        catalogDetails.review_schedule ||
        catalogDetails.reviewSchedule ||
        originalNodeData?.["Review Schedule"],
      Privileged:
        catalogDetails.privileged ||
        catalogDetails.privileged ||
        originalNodeData?.["Privileged"],
      "Non Persistent Access":
        catalogDetails.nonPersistentAccess ||
        catalogDetails.non_persistent_access ||
        catalogDetails.nonPersistentAccess ||
        originalNodeData?.["Non Persistent Access"],

      // Additional details
      "Audit Comments":
        catalogDetails.auditComments ||
        catalogDetails.audit_comments ||
        catalogDetails.auditComments ||
        originalNodeData?.["Audit Comments"],
      "Account Type Restriction":
        catalogDetails.accountTypeRestriction ||
        catalogDetails.account_type_restriction ||
        catalogDetails.accountTypeRestriction ||
        originalNodeData?.["Account Type Restriction"],
      Requestable:
        catalogDetails.requestable ||
        catalogDetails.requestable ||
        originalNodeData?.["Requestable"],
      "Pre- Requisite":
        catalogDetails.prerequisite ||
        catalogDetails.prerequisite ||
        originalNodeData?.["Pre- Requisite"],
      "Pre-Requisite Details":
        catalogDetails.prerequisiteDetails ||
        catalogDetails.prerequisite_details ||
        catalogDetails.prerequisiteDetails ||
        originalNodeData?.["Pre-Requisite Details"],
      "Auto Assign Access Policy":
        catalogDetails.autoAssignAccessPolicy ||
        catalogDetails.auto_assign_access_policy ||
        catalogDetails.autoAssignAccessPolicy ||
        originalNodeData?.["Auto Assign Access Policy"],
      "Provisioner Group":
        catalogDetails.provisionerGroup ||
        catalogDetails.provisioner_group ||
        catalogDetails.provisionerGroup ||
        originalNodeData?.["Provisioner Group"],
      "Provisioning Steps":
        catalogDetails.provisioningSteps ||
        catalogDetails.provisioning_steps ||
        catalogDetails.provisioningSteps ||
        originalNodeData?.["Provisioning Steps"],
      "Provisioning Mechanism":
        catalogDetails.provisioningMechanism ||
        catalogDetails.provisioning_mechanism ||
        catalogDetails.provisioningMechanism ||
        originalNodeData?.["Provisioning Mechanism"],
      "Action on Native Change":
        catalogDetails.actionOnNativeChange ||
        catalogDetails.action_on_native_change ||
        catalogDetails.actionOnNativeChange ||
        originalNodeData?.["Action on Native Change"],
      "Total Assignments":
        catalogDetails.totalAssignments ||
        catalogDetails.total_assignments ||
        catalogDetails.totalAssignments ||
        originalNodeData?.["Total Assignments"],
      "Dynamic Tag":
        catalogDetails.tags ||
        catalogDetails.dynamicTag ||
        catalogDetails.tags ||
        originalNodeData?.["Dynamic Tag"],
      __catalogIdForMapping: pickString(
        catalogDetails.id,
        catalogDetails.catalogid,
        catalogDetails.catalogId,
        catalogDetails.catalog_id,
        originalNodeData?.__catalogIdForMapping
      ),
    };

    // Return the original data with the mapped fields
    return {
      ...originalNodeData,
      ...fieldMappings,
    };
  };

  // Client-side pagination logic
  const totalItems = accountsRowData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = accountsRowData.slice(startIndex, endIndex);

  const handleSelect = (category: string, index: number) => {
    setSelected((prev) => ({
      ...prev,
      [category]: prev[category] === index ? null : index,
    }));
  };

  const toggleSidePanel = (data: any) => {
    // Use the catalogDetails from the existing data instead of making API call
    const catalogDetails = data?.catalogDetails;

    console.log("Row data structure:", data);
    console.log("Available keys in row data:", Object.keys(data || {}));

    let finalData = data;
    if (catalogDetails) {
      console.log("Using catalogDetails:", catalogDetails);
      setEntitlementDetails(catalogDetails);
      // Update nodeData with mapped catalog data
      finalData = mapApiDataToNodeData(catalogDetails, data);
      console.log("Mapped Data from catalogDetails:", finalData);
    } else {
      console.warn("No catalogDetails found in row data");
      console.log("Available data fields:", Object.keys(data || {}));
      // If no catalogDetails, try to use the data directly
      console.log("Using row data directly for entitlement details");
      setEntitlementDetails(data);
    }

    setNodeData(finalData);

    // Create the entitlement details sidebar component
    const EntitlementDetailsSidebarContent = () => {
      const [localEditMode, setLocalEditMode] = useState(false);
      const [localEditableData, setLocalEditableData] = useState<any>(null);
      const [localExpandedFrames, setLocalExpandedFrames] = useState({
        general: false,
        business: false,
        technical: false,
        security: false,
        lifecycle: false,
      });
      const [associatedRows, setAssociatedRows] = useState<Record<string, unknown>[]>([]);
      const [associatedLoading, setAssociatedLoading] = useState(true);
      const [associatedError, setAssociatedError] = useState<string | null>(null);
      const [associatedModalOpen, setAssociatedModalOpen] = useState(false);
      const [showCatalogAddList, setShowCatalogAddList] = useState(false);
      const [catalogAddItems, setCatalogAddItems] = useState<any[]>([]);
      const [catalogAddLoading, setCatalogAddLoading] = useState(false);
      const [catalogAddError, setCatalogAddError] = useState<string | null>(null);
      const [catalogAddSearch, setCatalogAddSearch] = useState("");
      const [catalogAddSelectedKeys, setCatalogAddSelectedKeys] = useState<string[]>([]);
      const [mappingAddInProgress, setMappingAddInProgress] = useState(false);
      const [mappingAddError, setMappingAddError] = useState<string | null>(null);
      const [mappingRemoveIndex, setMappingRemoveIndex] = useState<number | null>(null);
      const [mappingRemoveError, setMappingRemoveError] = useState<string | null>(null);
      const [assignmentRows, setAssignmentRows] = useState<Record<string, unknown>[]>([]);
      const [assignmentLoading, setAssignmentLoading] = useState(false);
      const [assignmentError, setAssignmentError] = useState<string | null>(null);

      useEffect(() => {
        setLocalEditableData({ ...finalData });
      }, []);

      useEffect(() => {
        const catalogId = resolveCatalogIdFromEntitlementRow(finalData);
        if (!catalogId) {
          setAssociatedLoading(false);
          setAssociatedError("Catalog id is not available for this entitlement.");
          setAssociatedRows([]);
          return;
        }
        let cancelled = false;
        (async () => {
          setAssociatedLoading(true);
          setAssociatedError(null);
          try {
            const url = `https://preview.keyforge.ai/catalog/api/v1/ACMECOM/mapping/${CATALOG_MAPPING_SCOPE_ID}/${encodeURIComponent(
              catalogId
            )}`;
            const res = await fetch(url);
            const json = await res.json().catch(() => null);
            if (!res.ok) {
              const msg =
                json &&
                typeof json === "object" &&
                (String((json as any).message || (json as any).errorMessage || (json as any).error || "").trim() ||
                  "");
              throw new Error(
                msg || (res.status === 400 ? "Invalid mapping request" : `Request failed (${res.status})`)
              );
            }
            if (json && typeof json === "object" && "executionStatus" in (json as object)) {
              const st = String((json as any).executionStatus).toLowerCase();
              if (st !== "success" && st !== "partial" && st !== "partial_success") {
                const errMsg = pickString(
                  (json as any).errorMessage,
                  (json as any).error_message,
                  (json as any).message,
                  (json as any).ErrorMessage
                );
                throw new Error(errMsg || "Mapping API returned a non-success status");
              }
            }
            const rows = extractMappingRowsFromResponse(json).filter((r) =>
              rowHasMappingId(r)
            );
            if (!cancelled) setAssociatedRows(rows);
          } catch (e) {
            if (!cancelled) {
              setAssociatedError(
                e instanceof Error ? e.message : "Failed to load associated mappings"
              );
              setAssociatedRows([]);
            }
          } finally {
            if (!cancelled) setAssociatedLoading(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }, []);

      useEffect(() => {
        const entId = resolveEntitlementIdForAssignmentQuery(finalData);
        if (!entId || !UUID_RE.test(entId)) {
          setAssignmentRows([]);
          setAssignmentError(null);
          setAssignmentLoading(false);
          if (entId && !UUID_RE.test(entId)) {
            setAssignmentError("Invalid entitlement id for assignment query.");
          }
          return;
        }
        let cancelled = false;
        (async () => {
          setAssignmentLoading(true);
          setAssignmentError(null);
          try {
            const res = await fetch(
              "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: `select * from public.kf_entitlement_assignment_v where entitlementid='${entId}'::uuid`,
                  parameters: [],
                }),
              }
            );
            const data = (await res.json().catch(() => null)) as {
              errorMessage?: string;
              message?: string;
            } | null;
            if (!res.ok) {
              throw new Error(
                pickString(data?.errorMessage, data?.message) ||
                  (res.status === 400 ? "Invalid query" : `Request failed (${res.status})`)
              );
            }
            const rows = extractExecuteQueryRows(data);
            if (!cancelled) setAssignmentRows(rows);
          } catch (e) {
            if (!cancelled) {
              setAssignmentError(
                e instanceof Error ? e.message : "Failed to load entitlement assignments"
              );
              setAssignmentRows([]);
            }
          } finally {
            if (!cancelled) setAssignmentLoading(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [finalData]);

      useEffect(() => {
        if (!associatedModalOpen) return;
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Escape") setAssociatedModalOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [associatedModalOpen]);

      useEffect(() => {
        if (!associatedModalOpen) {
          setShowCatalogAddList(false);
          setCatalogAddSearch("");
          setCatalogAddSelectedKeys([]);
          setMappingAddError(null);
          setMappingAddInProgress(false);
          setMappingRemoveError(null);
          setMappingRemoveIndex(null);
        }
      }, [associatedModalOpen]);

      const catalogAddFiltered = useMemo(() => {
        const q = catalogAddSearch.trim().toLowerCase();
        if (!q) return catalogAddItems;
        return catalogAddItems.filter((item: any) => {
          const c = item?.catalogDetails;
          const n =
            pickString(
              item.entitlementName,
              item["Ent Name"],
              item.name,
              c?.name,
              c?.entitlementName
            ) ?? "";
          const a =
            pickString(
              item.applicationName,
              item["App Name"],
              item.applicationname,
              c?.applicationname,
              c?.applicationName
            ) ?? "";
          return `${n} ${a}`.toLowerCase().includes(q);
        });
      }, [catalogAddItems, catalogAddSearch]);

      const toggleLocalFrame = (frame: keyof typeof localExpandedFrames) => {
        setLocalExpandedFrames((prev) => ({ ...prev, [frame]: !prev[frame] }));
      };

      const renderSideBySideFieldLocal = (
        label1: string,
        value1: any,
        label2: string,
        value2: any,
        fieldKey1?: string,
        fieldKey2?: string,
        isDate1?: boolean,
        isDate2?: boolean
      ) => {
        const currentData = localEditMode ? localEditableData : finalData;
        let val1 = fieldKey1 ? currentData?.[fieldKey1] : value1;
        let val2 = fieldKey2 ? currentData?.[fieldKey2] : value2;

        // In edit mode, use raw values; in view mode, format dates if needed
        if (!localEditMode) {
          if (isDate1 && val1) {
            val1 = formatDate(val1);
          }
          if (isDate2 && val2) {
            val2 = formatDate(val2);
          }
        }

        if (localEditMode) {
          const inputType1 = isDate1 ? "date" : "text";
          const inputType2 = isDate2 ? "date" : "text";
          
          return (
            <div className="flex space-x-4 text-sm">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1 font-medium">{label1}:</label>
                <input
                  type={inputType1}
                  value={val1?.toString() || ""}
                  onChange={(e) => {
                    if (fieldKey1) {
                      setLocalEditableData((prev: any) => ({
                        ...prev,
                        [fieldKey1]: e.target.value,
                      }));
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1 font-medium">{label2}:</label>
                <input
                  type={inputType2}
                  value={val2?.toString() || ""}
                  onChange={(e) => {
                    if (fieldKey2) {
                      setLocalEditableData((prev: any) => ({
                        ...prev,
                        [fieldKey2]: e.target.value,
                      }));
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          );
        }

        return (
          <div className="flex space-x-4 text-sm text-gray-700">
            <div className="flex-1">
              <strong>{label1}:</strong> {val1?.toString() || "N/A"}
            </div>
            <div className="flex-1">
              <strong>{label2}:</strong> {val2?.toString() || "N/A"}
            </div>
          </div>
        );
      };

      const renderSingleFieldLocal = (label: string, value: any, fieldKey?: string) => {
        const currentData = localEditMode ? localEditableData : finalData;
        const val = fieldKey ? currentData?.[fieldKey] : value;

        if (localEditMode) {
          return (
            <div className="text-sm">
              <label className="block text-xs text-gray-500 mb-1 font-medium">{label}:</label>
              <input
                type="text"
                value={val?.toString() || ""}
                onChange={(e) => {
                  if (fieldKey) {
                    setLocalEditableData((prev: any) => ({
                      ...prev,
                      [fieldKey]: e.target.value,
                    }));
                  }
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          );
        }

        return (
          <div className="text-sm text-gray-700 break-all min-w-0">
            <strong>{label}:</strong> {val?.toString() || "N/A"}
          </div>
        );
      };

      const callMappingRemoveApi = async (contextCatalogId: string, mappingId: string) => {
        const removedBy =
          pickString(reviewerId) || "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91";
        const url = `https://preview.keyforge.ai/catalog/api/v1/ACMECOM/mapping/${CATALOG_MAPPING_SCOPE_ID}/${encodeURIComponent(
          contextCatalogId
        )}/remove`;
        const res = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ removedBy, mappingIds: [mappingId] }),
        });
        const data = (await res.json().catch(() => null)) as {
          executionStatus?: string;
          errorMessage?: string;
          message?: string;
        } | null;
        if (!res.ok) {
          throw new Error(
            pickString(data?.errorMessage, data?.message) ||
              (res.status === 400 ? "Invalid mapping remove request" : `Remove failed (${res.status})`)
          );
        }
        if (data && data.executionStatus) {
          const st = String(data.executionStatus).toLowerCase();
          if (st !== "success" && st !== "partial" && st !== "partial_success") {
            throw new Error(
              pickString(data.errorMessage, data.message) || "Mapping remove was not successful"
            );
          }
        }
        return data;
      };

      const removeAssociatedRow = async (rowIndex: number) => {
        setMappingRemoveError(null);
        const contextCatalogId = resolveCatalogIdFromEntitlementRow(finalData);
        if (!contextCatalogId) {
          setMappingRemoveError("Catalog id is not available for this entitlement.");
          return;
        }
        const row = associatedRows[rowIndex];
        const mappingId = pickMappingIdFromRow(row);
        if (!mappingId) {
          setMappingRemoveError(
            "Mapping id is missing for this row. Refresh the list or remove it after the server returns an id."
          );
          return;
        }
        setMappingRemoveIndex(rowIndex);
        try {
          await callMappingRemoveApi(contextCatalogId, mappingId);
          setAssociatedRows((prev) => prev.filter((_, i) => i !== rowIndex));
        } catch (e) {
          setMappingRemoveError(
            e instanceof Error ? e.message : "Failed to remove mapping. Please try again."
          );
        } finally {
          setMappingRemoveIndex(null);
        }
      };

      const openCatalogItemPicker = async () => {
        setShowCatalogAddList(true);
        setCatalogAddSearch("");
        setMappingAddError(null);
        setMappingRemoveError(null);
        if (!id?.trim()) {
          setCatalogAddError("Application instance is not available.");
          setCatalogAddItems([]);
          setCatalogAddSelectedKeys([]);
          setCatalogAddLoading(false);
          return;
        }
        setCatalogAddError(null);
        setCatalogAddLoading(true);
        setCatalogAddItems([]);
        try {
          const entReviewerId =
            reviewerId?.trim() || "ec527a50-0944-4b31-b239-05518c87a743";
          const url = `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getAppEntitlements/${encodeURIComponent(
            entReviewerId
          )}/${encodeURIComponent(id)}`;
          const res = await fetch(url);
          const data = (await res.json().catch(() => null)) as {
            executionStatus?: string;
            errorMessage?: string;
            message?: string;
            items?: unknown[];
          } | null;
          if (!res.ok) {
            throw new Error(
              pickString(data?.errorMessage, data?.message) ||
                (res.status === 400 ? "Invalid request" : `Request failed (${res.status})`)
            );
          }
          if (data && data.executionStatus) {
            const st = String(data.executionStatus).toLowerCase();
            if (st !== "success" && st !== "partial" && st !== "partial_success") {
              throw new Error(
                pickString(data.errorMessage, data.message) || "Application entitlements could not be loaded."
              );
            }
          }
          const items = data?.items;
          setCatalogAddItems(Array.isArray(items) ? items : []);
          setCatalogAddSelectedKeys([]);
        } catch (e) {
          setCatalogAddError(
            e instanceof Error ? e.message : "Failed to load access items for this application."
          );
        } finally {
          setCatalogAddLoading(false);
        }
      };

      const appendAccessItemsToAssociated = (
        rawItems: any[],
        extraMappingIds?: (string | undefined)[]
      ) => {
        if (rawItems.length === 0) return;
        setAssociatedRows((prev) => {
          const out: Record<string, unknown>[] = [...prev];
          for (let i = 0; i < rawItems.length; i++) {
            const item = rawItems[i];
            const c = item?.catalogDetails;
            const name = pickString(
              item.entitlementName,
              item["Ent Name"],
              item.name,
              c?.name,
              c?.entitlementName,
              c?.entitlementname
            );
            const app = pickString(
              item.applicationName,
              item["App Name"],
              item.applicationname,
              item.appName,
              c?.applicationname,
              c?.applicationName,
              c?.appName
            );
            const sourceId = getTargetCatalogIdFromAccessItem(item);
            if (
              sourceId &&
              out.some(
                (r) =>
                  pickString(
                    (r as any).source_catalogid,
                    (r as any).id,
                    (r as any).catalogid
                  ) === sourceId
              )
            ) {
              continue;
            }
            const mapId = pickString(extraMappingIds?.[i]);
            if (!mapId) continue;
            out.push({
              catalog_item_name: name ?? null,
              mapped_item_name: name ?? null,
              source_applicationname: app ?? null,
              source_catalogid: sourceId ?? null,
              __mappingId: mapId,
            });
          }
          return out;
        });
      };

      const toggleCatalogAddKey = (key: string) => {
        setCatalogAddSelectedKeys((prev) =>
          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
      };

      const callMappingAddApi = async (contextCatalogId: string, selectedItems: any[]) => {
        const appInstanceId = id?.trim() || "";
        if (!appInstanceId) {
          throw new Error("Application instance is not available.");
        }
        const mappedBy =
          pickString(reviewerId) || "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91";
        const mappings: Array<NonNullable<ReturnType<typeof buildMappingEntryFromAccessItem>>> = [];
        for (const item of selectedItems) {
          const entry = buildMappingEntryFromAccessItem(item, appInstanceId);
          if (!entry) {
            throw new Error("One of the selected access items is missing a catalog id.");
          }
          mappings.push(entry);
        }
        const url = `https://preview.keyforge.ai/catalog/api/v1/ACMECOM/mapping/${CATALOG_MAPPING_SCOPE_ID}/${encodeURIComponent(
          contextCatalogId
        )}/add`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ mappedBy, mappings }),
        });
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) {
          const errMsg = pickString(
            data?.errorMessage as string | undefined,
            data?.message as string | undefined
          );
          throw new Error(
            errMsg ||
              (res.status === 400 ? "Invalid mapping add request" : `Add failed (${res.status})`)
          );
        }
        if (data && data.executionStatus) {
          const st = String(data.executionStatus).toLowerCase();
          if (st !== "success" && st !== "partial" && st !== "partial_success") {
            throw new Error(
              pickString(
                data.errorMessage as string | undefined,
                data.message as string | undefined
              ) || "Mapping add was not successful"
            );
          }
        }
        return data;
      };

      const addSelectedAccessToTable = async () => {
        if (catalogAddSelectedKeys.length === 0) return;
        setMappingAddError(null);
        const keySet = new Set(catalogAddSelectedKeys);
        const selected = catalogAddItems.filter((item, idx) =>
          keySet.has(getAccessItemKey(item, idx))
        );
        const contextCatalogId = resolveCatalogIdFromEntitlementRow(finalData);
        if (!contextCatalogId) {
          setMappingAddError("Catalog id is not available for this entitlement.");
          return;
        }
        if (!id?.trim()) {
          setMappingAddError("Application instance is not available.");
          return;
        }
        setMappingAddInProgress(true);
        try {
          const addJson = await callMappingAddApi(contextCatalogId, selected);
          const newIds = extractNewMappingIdsFromAddResponse(
            addJson,
            selected.length
          );
          appendAccessItemsToAssociated(selected, newIds);
          setCatalogAddSelectedKeys([]);
        } catch (e) {
          setMappingAddError(
            e instanceof Error ? e.message : "Failed to add access mapping. Please try again."
          );
        } finally {
          setMappingAddInProgress(false);
        }
      };

      const selectAllFilteredAccess = () => {
        const keys = catalogAddFiltered.map((item: any) => {
          const idx = catalogAddItems.indexOf(item);
          return getAccessItemKey(item, idx >= 0 ? idx : 0);
        });
        setCatalogAddSelectedKeys((prev) => [...new Set([...prev, ...keys])]);
      };

      const clearCatalogAddSelection = () => setCatalogAddSelectedKeys([]);

      const renderAssociatedTable = (showRemoveColumn: boolean) => (
        <div>
          {showRemoveColumn && mappingRemoveError ? (
            <p className="text-sm text-red-600 mb-2">{mappingRemoveError}</p>
          ) : null}
          <div className="border border-gray-200 rounded-md overflow-x-auto max-w-full">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-1.5 font-medium text-gray-700">Entitlement</th>
                  <th className="px-2 py-1.5 font-medium text-gray-700">Application</th>
                  {showRemoveColumn ? (
                    <th
                      className="w-10 px-1 py-1.5 font-medium text-red-600 text-center"
                      scope="col"
                    >
                      <span className="sr-only">Remove</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {associatedRows.map((row, i) => {
                  const rowMappingId = pickMappingIdFromRow(row);
                  return (
                    <tr
                      key={rowMappingId ? String(rowMappingId) : `assoc-row-${i}`}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-2 py-1.5 text-gray-800 break-words max-w-[200px]">
                        {pickMappedItemField(row)}
                      </td>
                      <td className="px-2 py-1.5 text-gray-800 break-words max-w-[200px]">
                        {pickMappedAppField(row)}
                      </td>
                      {showRemoveColumn ? (
                        <td className="px-1 py-1.5 align-middle text-center w-10">
                          <button
                            type="button"
                            onClick={() => void removeAssociatedRow(i)}
                            disabled={mappingRemoveIndex !== null}
                            className="inline-flex p-1 rounded text-red-600 bg-red-50 border border-red-200 hover:text-red-800 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove mapping"
                            aria-label="Remove this mapping"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );

      return (
        <>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {entitlementDetailsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{entitlementDetailsError}</p>
              </div>
            ) : (
              <>
                {localEditMode && (
                  <input
                    type="text"
                    value={
                      (localEditableData?.["Ent Name"] ||
                        localEditableData?.entitlementName ||
                        "") as string
                    }
                    onChange={(e) => {
                      setLocalEditableData((prev: any) => ({
                        ...prev,
                        "Ent Name": e.target.value,
                        entitlementName: e.target.value,
                      }));
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-md font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
                <div className={localEditMode ? "mt-2" : ""}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase text-gray-500">Description:</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!localEditMode) {
                          setLocalEditableData({ ...finalData });
                          setLocalExpandedFrames({
                            general: true,
                            business: true,
                            technical: true,
                            security: true,
                            lifecycle: true,
                          });
                          setLocalEditMode(true);
                        } else {
                          setLocalEditMode(false);
                          setLocalEditableData(null);
                        }
                      }}
                      className={`p-1.5 rounded transition-colors flex-shrink-0 ${
                        localEditMode
                          ? "bg-blue-500 hover:bg-blue-600"
                          : "hover:bg-gray-200"
                      }`}
                      title={localEditMode ? "Save changes" : "Edit entitlement"}
                    >
                      <Edit className={`w-4 h-4 ${localEditMode ? "text-white" : "text-gray-600 hover:text-blue-600"}`} />
                    </button>
                  </div>
                  {localEditMode ? (
                    <textarea
                      value={
                        (localEditableData?.["Ent Description"] ||
                          localEditableData?.description ||
                          "") as string
                      }
                      onChange={(e) => {
                        setLocalEditableData((prev: any) => ({
                          ...prev,
                          "Ent Description": e.target.value,
                          description: e.target.value,
                        }));
                      }}
                      rows={3}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 break-words break-all whitespace-pre-wrap max-w-full mt-1">
                      {finalData?.["Ent Description"] ||
                        (finalData as any)?.description ||
                        "-"}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="space-y-4">
              {/* General Frame */}
              <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                <button
                  className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                  onClick={() => toggleLocalFrame("general")}
                >
                  {localExpandedFrames.general ? (
                    <ChevronDown size={20} className="mr-2" />
                  ) : (
                    <ChevronUp size={20} className="mr-2" />
                  )}
                  General
                </button>
                {localExpandedFrames.general && (
                  <div className="p-4 space-y-2">
                    {renderSideBySideFieldLocal(
                      "Type",
                      finalData?.["Ent Type"],
                      "#Assignments",
                      finalData?.["Total Assignments"],
                      "Ent Type",
                      "Total Assignments"
                    )}
                    {renderSideBySideFieldLocal(
                      "Application",
                      finalData?.["App Name"],
                      "Tag(s)",
                      finalData?.["Dynamic Tag"],
                      "App Name",
                      "Dynamic Tag"
                    )}
                  </div>
                )}
              </div>
              {/* Business Frame */}
              <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                <button
                  className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                  onClick={() => toggleLocalFrame("business")}
                >
                  {localExpandedFrames.business ? (
                    <ChevronDown size={20} className="mr-2" />
                  ) : (
                    <ChevronUp size={20} className="mr-2" />
                  )}
                  Business
                </button>
                {localExpandedFrames.business && (
                  <div className="p-4 space-y-2">
                    {renderSingleFieldLocal(
                      "Objective",
                      finalData?.["Business Objective"],
                      "Business Objective"
                    )}
                    {renderSideBySideFieldLocal(
                      "Business Unit",
                      finalData?.["Business Unit"],
                      "Entitlement owner",
                      finalData?.["Ent Owner"],
                      "Business Unit",
                      "Ent Owner"
                    )}
                    {renderSingleFieldLocal(
                      "Regulatory Scope",
                      finalData?.["Compliance Type"],
                      "Compliance Type"
                    )}
                    {renderSideBySideFieldLocal(
                      "Data Classification",
                      finalData?.["Data Classification"],
                      "Cost Center",
                      finalData?.["Cost Center"],
                      "Data Classification",
                      "Cost Center"
                    )}
                  </div>
                )}
              </div>
              {/* Technical Frame */}
              <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                <button
                  className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                  onClick={() => toggleLocalFrame("technical")}
                >
                  {localExpandedFrames.technical ? (
                    <ChevronDown size={20} className="mr-2" />
                  ) : (
                    <ChevronUp size={20} className="mr-2" />
                  )}
                  Technical
                </button>
                {localExpandedFrames.technical && (
                  <div className="p-4 space-y-2">
                    {renderSideBySideFieldLocal(
                      "Created On",
                      finalData?.["Created On"],
                      "Last Sync",
                      finalData?.["Last Sync"],
                      "Created On",
                      "Last Sync",
                      true,
                      true
                    )}
                    {renderSideBySideFieldLocal(
                      "Application",
                      finalData?.["App Name"],
                      "App Instance",
                      finalData?.["App Instance"],
                      "App Name",
                      "App Instance"
                    )}
                    {renderSideBySideFieldLocal(
                      "Application Owner",
                      finalData?.["App Owner"],
                      "Entitlement owner",
                      finalData?.["Ent Owner"],
                      "App Owner",
                      "Ent Owner"
                    )}
                    {renderSideBySideFieldLocal(
                      "Hierarchy",
                      finalData?.["Hierarchy"],
                      "MFA Status",
                      finalData?.["MFA Status"],
                      "Hierarchy",
                      "MFA Status"
                    )}
                    <div className="text-sm text-gray-700">
                      <div className="mb-0.5 text-sm">
                        <strong className="text-gray-900" style={{ fontWeight: 700 }}>
                          Assigned to/Member of
                        </strong>
                      </div>
                      <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-800 max-h-20 overflow-y-auto leading-snug">
                        {assignmentLoading ? (
                          <span className="text-gray-500">Loading…</span>
                        ) : !resolveEntitlementIdForAssignmentQuery(finalData) ? (
                          <span className="text-gray-500">Entitlement id not available</span>
                        ) : assignmentError ? (
                          <span className="text-amber-800">{assignmentError}</span>
                        ) : assignmentRows.length === 0 ? (
                          <span className="text-gray-500">No assignments</span>
                        ) : assignmentRows.length === 1 ? (
                          <span className="break-words whitespace-pre-wrap">
                            {pickAssignmentLabel(assignmentRows[0])}
                          </span>
                        ) : (
                          <ul className="list-disc pl-3.5 m-0 space-y-0.5 marker:text-gray-400">
                            {assignmentRows.map((row, i) => (
                              <li key={i} className="break-words">
                                {pickAssignmentLabel(row)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    {renderSingleFieldLocal(
                      "License Type",
                      finalData?.["License Type"],
                      "License Type"
                    )}
                    {renderSingleFieldLocal(
                      "Logical Application",
                      finalData?.["Logical Application"],
                      "Logical Application"
                    )}
                    {renderSingleFieldLocal(
                      "Application Category",
                      finalData?.["Application Category"],
                      "Application Category"
                    )}
                    <div className="text-sm text-gray-700 pt-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-medium text-gray-800">Associated Access</div>
                        <button
                          type="button"
                          onClick={() => setAssociatedModalOpen(true)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      </div>
                      {associatedLoading ? (
                        <div className="text-xs text-gray-500 py-1">Loading mappings…</div>
                      ) : associatedError ? (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                          {associatedError}
                        </div>
                      ) : associatedRows.length === 0 ? (
                        <div className="text-xs text-gray-500">No associated mappings found.</div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto overflow-x-auto">
                          {renderAssociatedTable(false)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Security Frame */}
              <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                <button
                  className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                  onClick={() => toggleLocalFrame("security")}
                >
                  {localExpandedFrames.security ? (
                    <ChevronDown size={20} className="mr-2" />
                  ) : (
                    <ChevronUp size={20} className="mr-2" />
                  )}
                  Security
                </button>
                {localExpandedFrames.security && (
                  <div className="p-4 space-y-2">
                    {renderSideBySideFieldLocal(
                      "Risk",
                      finalData?.["Risk"],
                      "Certifiable",
                      finalData?.["Certifiable"],
                      "Risk",
                      "Certifiable"
                    )}
                    {renderSideBySideFieldLocal(
                      "Revoke on Disable",
                      finalData?.["Revoke on Disable"],
                      "Shared Pwd",
                      finalData?.["Shared Pwd"],
                      "Revoke on Disable",
                      "Shared Pwd"
                    )}
                    {renderSingleFieldLocal(
                      "SoD/Toxic Combination",
                      finalData?.["SOD Check"],
                      "SOD Check"
                    )}
                    {renderSingleFieldLocal(
                      "Access Scope",
                      finalData?.["Access Scope"],
                      "Access Scope"
                    )}
                    {renderSideBySideFieldLocal(
                      "Review Schedule",
                      finalData?.["Review Schedule"],
                      "Last Reviewed On",
                      finalData?.["Last Reviewed on"],
                      "Review Schedule",
                      "Last Reviewed on",
                      false,
                      true
                    )}
                    {renderSideBySideFieldLocal(
                      "Privileged",
                      finalData?.["Privileged"],
                      "Non Persistent Access",
                      finalData?.["Non Persistent Access"],
                      "Privileged",
                      "Non Persistent Access"
                    )}
                    {renderSingleFieldLocal(
                      "Audit Comments",
                      finalData?.["Audit Comments"],
                      "Audit Comments"
                    )}
                    {renderSingleFieldLocal(
                      "Account Type Restriction",
                      finalData?.["Account Type Restriction"],
                      "Account Type Restriction"
                    )}
                  </div>
                )}
              </div>
              {/* Lifecycle Frame */}
              <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                <button
                  className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                  onClick={() => toggleLocalFrame("lifecycle")}
                >
                  {localExpandedFrames.lifecycle ? (
                    <ChevronDown size={20} className="mr-2" />
                  ) : (
                    <ChevronUp size={20} className="mr-2" />
                  )}
                  Lifecycle
                </button>
                {localExpandedFrames.lifecycle && (
                  <div className="p-4 space-y-2">
                    {renderSideBySideFieldLocal(
                      "Requestable",
                      finalData?.["Requestable"],
                      "Training Code",
                      finalData?.["Pre- Requisite"],
                      "Requestable",
                      "Pre- Requisite"
                    )}
                    {renderSingleFieldLocal(
                      "Training Details",
                      finalData?.["Pre-Requisite Details"],
                      "Pre-Requisite Details"
                    )}
                    {renderSingleFieldLocal(
                      "Auto Assign Access Policy",
                      finalData?.["Auto Assign Access Policy"],
                      "Auto Assign Access Policy"
                    )}
                    {renderSingleFieldLocal(
                      "Provisioner Group",
                      finalData?.["Provisioner Group"],
                      "Provisioner Group"
                    )}
                    {renderSingleFieldLocal(
                      "Provisioning Steps",
                      finalData?.["Provisioning Steps"],
                      "Provisioning Steps"
                    )}
                    {renderSingleFieldLocal(
                      "Provisioning Mechanism",
                      finalData?.["Provisioning Mechanism"],
                      "Provisioning Mechanism"
                    )}
                    {renderSingleFieldLocal(
                      "Action on Native Change",
                      finalData?.["Action on Native Change"],
                      "Action on Native Change"
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {associatedModalOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center px-3"
              data-right-sidebar-keep
              onClick={() => setAssociatedModalOpen(false)}
            >
              <div
                className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="associated-access-dialog-title"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
                  <h2
                    id="associated-access-dialog-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    Associated Access
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAssociatedModalOpen(false)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto min-h-0">
                  {associatedLoading ? (
                    <div className="text-sm text-gray-500 py-4">Loading mappings…</div>
                  ) : associatedError ? (
                    <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      {associatedError}
                    </div>
                  ) : (
                    <div>
                      {associatedRows.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">No associated mappings found.</div>
                      ) : (
                        renderAssociatedTable(true)
                      )}
                      <div className="mt-3 pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={openCatalogItemPicker}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2} />
                          Add
                        </button>
                        {showCatalogAddList && (
                          <button
                            type="button"
                            onClick={() => setShowCatalogAddList(false)}
                            className="text-sm text-gray-600 hover:text-gray-900"
                          >
                            Hide catalog list
                          </button>
                        )}
                      </div>
                      {showCatalogAddList && (
                        <div className="mt-4 border border-gray-200 rounded-lg bg-gray-50/50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-gray-800">Access for this application</h3>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={selectAllFilteredAccess}
                                disabled={mappingAddInProgress}
                                className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Select visible
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                onClick={clearCatalogAddSelection}
                                disabled={mappingAddInProgress}
                                className="text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Clear selection
                              </button>
                            </div>
                          </div>
                          <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="search"
                              value={catalogAddSearch}
                              onChange={(e) => setCatalogAddSearch(e.target.value)}
                              placeholder="Search by entitlement or application…"
                              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-2 mb-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-gray-500">
                                {catalogAddSelectedKeys.length} selected
                              </p>
                              <button
                                type="button"
                                onClick={() => void addSelectedAccessToTable()}
                                disabled={
                                  catalogAddSelectedKeys.length === 0 || mappingAddInProgress
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-4 h-4" strokeWidth={2} />
                                {mappingAddInProgress ? "Adding…" : "Add selected"}
                              </button>
                            </div>
                            {mappingAddError ? (
                              <p className="text-sm text-red-600">{mappingAddError}</p>
                            ) : null}
                          </div>
                          <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 bg-white">
                            {catalogAddLoading && (
                              <p className="text-sm text-gray-500 p-2">Loading access list…</p>
                            )}
                            {catalogAddError && !catalogAddLoading && (
                              <p className="text-sm text-red-600 p-2">{catalogAddError}</p>
                            )}
                            {!catalogAddLoading &&
                              !catalogAddError &&
                              catalogAddFiltered.length === 0 && (
                                <p className="text-sm text-gray-500 p-2">No access items found.</p>
                              )}
                            {!catalogAddLoading &&
                              !catalogAddError &&
                              catalogAddFiltered.map((item: any) => {
                                const listIdx = catalogAddItems.indexOf(item);
                                const idx = listIdx >= 0 ? listIdx : 0;
                                const c = item?.catalogDetails;
                                const n =
                                  pickString(
                                    item.entitlementName,
                                    item["Ent Name"],
                                    item.name,
                                    c?.name,
                                    c?.entitlementName
                                  ) ?? "—";
                                const a =
                                  pickString(
                                    item.applicationName,
                                    item["App Name"],
                                    item.applicationname,
                                    c?.applicationname,
                                    c?.applicationName
                                  ) ?? "—";
                                const k = getAccessItemKey(item, idx);
                                const checked = catalogAddSelectedKeys.includes(k);
                                return (
                                  <label
                                    key={k}
                                    className="flex items-start gap-2 w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleCatalogAddKey(k)}
                                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-gray-900">{n}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">{a}</div>
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setAssociatedModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      );
    };

    // Use the global sidebar instead of local state
    const entitlementName =
      finalData?.["Ent Name"] || (finalData as any)?.entitlementName || "Entitlement Details";
    openSidebar(<EntitlementDetailsSidebarContent />, { widthPx: 500, title: entitlementName });
  };

  const toggleFrame = (frame: keyof typeof expandedFrames) => {
    setExpandedFrames((prev) => ({ ...prev, [frame]: !prev[frame] }));
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gridApiRef.current || !nodeData) return;
    await updateActions("Approve", comment || "Approved via UI");
  };

  const handleRevoke = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gridApiRef.current || !nodeData) return;
    await updateActions("Revoke", comment || "Revoked via UI");
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentText(comment); // Load existing comment into the textarea
    setIsCommentModalOpen(true);
  };

  const handleSaveComment = () => {
    if (!commentText.trim()) return;

    setComment(commentText);
    setIsCommentModalOpen(false);
    setCommentText("");
  };

  const handleCancelComment = () => {
    setIsCommentModalOpen(false);
    setCommentText("");
  };

  const updateActions = async (actionType: string, justification: string) => {
    const payload = {
      entitlementAction: [
        {
          actionType,
          lineItemIds: [nodeData?.["Ent ID"]].filter(Boolean),
          justification,
        },
      ],
    };

    try {
      const response = await fetch(
        `https://preview.keyforge.ai/certification/api/v1/ACMECOM/updateAction/${reviewerId}/CERT_ID`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      gridApiRef.current?.applyTransaction({
        update: [{ ...nodeData, status: actionType }],
      });
      setLastAction(actionType);
      setError(null);
      setComment("");
      return await response.json();
    } catch (err: any) {
      setError(`Failed to update actions: ${err.message}`);
      console.error("API error:", err);
      throw err;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeSidebar]);

  useEffect(() => {
    setLastAction(null);
  }, [nodeData]);

  const formatDate = (date: string | undefined) => {
    return date ? formatDateMMDDYY(date) || "N/A" : "N/A";
  };

  const renderSideBySideField = (
    label1: string,
    value1: any,
    label2: string,
    value2: any,
    fieldKey1?: string,
    fieldKey2?: string,
    isDate1?: boolean,
    isDate2?: boolean
  ) => {
    const currentData = isEditMode ? editableNodeData : nodeData;
    let val1 = fieldKey1 ? currentData?.[fieldKey1] : value1;
    let val2 = fieldKey2 ? currentData?.[fieldKey2] : value2;

    // In edit mode, use raw values; in view mode, format dates if needed
    if (!isEditMode) {
      if (isDate1 && val1) {
        val1 = formatDate(val1);
      }
      if (isDate2 && val2) {
        val2 = formatDate(val2);
      }
    }

    if (isEditMode) {
      const inputType1 = isDate1 ? "date" : "text";
      const inputType2 = isDate2 ? "date" : "text";
      
      return (
        <div className="flex space-x-4 text-sm">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1 font-medium">{label1}:</label>
            <input
              type={inputType1}
              value={val1?.toString() || ""}
              onChange={(e) => {
                if (fieldKey1) {
                  setEditableNodeData((prev: any) => ({
                    ...prev,
                    [fieldKey1]: e.target.value,
                  }));
                }
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1 font-medium">{label2}:</label>
            <input
              type={inputType2}
              value={val2?.toString() || ""}
              onChange={(e) => {
                if (fieldKey2) {
                  setEditableNodeData((prev: any) => ({
                    ...prev,
                    [fieldKey2]: e.target.value,
                  }));
                }
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex space-x-4 text-sm text-gray-700">
        <div className="flex-1">
          <strong>{label1}:</strong> {val1?.toString() || "N/A"}
        </div>
        <div className="flex-1">
          <strong>{label2}:</strong> {val2?.toString() || "N/A"}
        </div>
      </div>
    );
  };

  const renderSingleField = (label: string, value: any, fieldKey?: string) => {
    const currentData = isEditMode ? editableNodeData : nodeData;
    const val = fieldKey ? currentData?.[fieldKey] : value;

    if (isEditMode) {
      return (
        <div className="text-sm">
          <label className="block text-xs text-gray-500 mb-1 font-medium">{label}:</label>
          <input
            type="text"
            value={val?.toString() || ""}
            onChange={(e) => {
              if (fieldKey) {
                setEditableNodeData((prev: any) => ({
                  ...prev,
                  [fieldKey]: e.target.value,
                }));
              }
            }}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
    }

    return (
      <div className="text-sm text-gray-700">
        <strong>{label}:</strong> {val?.toString() || "N/A"}
      </div>
    );
  };

  //   {
  //     account: "Aaliyah Munoz",
  //     accountStatus: "Active",
  //     accountType: "User",
  //     discoveryDate: "6/17/24",
  //     externalDomain: "No",
  //     userStatus: "Active",
  //     user: "Aaliyah Munoz",
  //   }
  // ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getAppAccounts/430ea9e6-3cff-449c-a24e-59c057f81e3d/${id}`
        );
        const data = await response.json();
        console.log(data);
        if (data.executionStatus === "success") {
          setAccountsRowData(data.items);
          setFilteredAccountsRowData(data.items);

          // Only update application details if they don't already exist
          // This prevents overriding the data from the applications list
          const existingDetails = localStorage.getItem("applicationDetails");
          if (!existingDetails) {
            // Extract application details from the first item or API response
            if (data.items && data.items.length > 0) {
              const firstItem = data.items[0];
              console.log("First item data:", firstItem);
              const applicationDetails = {
                applicationName: firstItem.applicationinstancename || "N/A",
                owner: firstItem.ownername || "N/A",
                lastSync:
                  firstItem.lastSync || firstItem.lastlogindate || "N/A",
              };
              console.log(
                "Application details to dispatch:",
                applicationDetails
              );

              // Store application data in localStorage for HeaderContent
              localStorage.setItem(
                "applicationDetails",
                JSON.stringify(applicationDetails)
              );

              // Also dispatch custom event
              const event = new CustomEvent("applicationDataChange", {
                detail: applicationDetails,
              });
              window.dispatchEvent(event);
              console.log("Event dispatched:", event);
            }
          } else {
            console.log(
              "Application details already exist, not overriding:",
              JSON.parse(existingDetails)
            );
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, [id]);

  // Filter accounts based on search query
  useEffect(() => {
    if (!accountsSearchQuery.trim()) {
      setFilteredAccountsRowData(accountsRowData);
    } else {
      const searchLower = accountsSearchQuery.toLowerCase();
      const filtered = accountsRowData.filter((item: any) => {
        // Search across multiple fields
        const accountName = (item.accountName || "").toLowerCase();
        const userDisplayName = (item.userDisplayName || "").toLowerCase();
        const entitlementName = (item.entitlementName || "").toLowerCase();
        const accountType = (item.accountType || "").toLowerCase();
        const userId = (item.userId || "").toLowerCase();
        const userStatus = (item.userStatus || "").toLowerCase();
        const userManager = (item.userManager || "").toLowerCase();
        const userDepartment = (item.userDepartment || "").toLowerCase();
        const jobTitle = (item.jobTitle || "").toLowerCase();
        
        return (
          accountName.includes(searchLower) ||
          userDisplayName.includes(searchLower) ||
          entitlementName.includes(searchLower) ||
          accountType.includes(searchLower) ||
          userId.includes(searchLower) ||
          userStatus.includes(searchLower) ||
          userManager.includes(searchLower) ||
          userDepartment.includes(searchLower) ||
          jobTitle.includes(searchLower)
        );
      });
      setFilteredAccountsRowData(filtered);
      // Reset to first page when search changes
      setCurrentPage(1);
    }
  }, [accountsRowData, accountsSearchQuery]);

  // Fetch service accounts data from API (same as service account page)
  useEffect(() => {
    const fetchServiceAccountsData = async () => {
      // Helper to optionally append extra static rows for SAP to visually fill the page
      const withSapStaticRows = (items: any[]): any[] => {
        try {
          const stored = typeof window !== "undefined"
            ? window.localStorage.getItem("applicationDetails")
            : null;
          if (!stored) return items;
          const parsed = JSON.parse(stored);
          const appName = (parsed?.applicationName || "").toString();
          if (!appName || !appName.toLowerCase().includes("sap")) {
            return items;
          }

          const orphanSummarySeed = [
            {
              accountName: "svc_fin_batch01",
              entitlementName: "ZISU_CS_DISPLAY_NOTIFICATION",
              description:
                "Oversees end-to-end payroll flows, validations, and costing. Ensures secure handling of sensitive pay data and approvals under governed workflows.",
            },
            {
              accountName: "svc_ap_integration",
              entitlementName: "ZNEW_CS_ACC_OFFICER",
              description:
                "Supervises utilities billing, invoicing, and collections. Ensures regulated workflows, dispute handling, and evidence under governed workflows.",
            },
            {
              accountName: "svc_hr_sync",
              entitlementName: "ZNEW_DM_REVENUE_ACC",
              description:
                "Executes directory group membership for routing access. Ensures SSO mapping and least-privilege enablement under governed workflows.",
            },
            {
              accountName: "svc_payroll_job",
              entitlementName: "ZISU_BILLING_INVOICE_DISPLAY",
              description:
                "Handles core SAP business activities. Ensures policy-aligned execution and oversight under governed workflows.",
            },
            {
              accountName: "svc_mm_interface",
              entitlementName: "ZNEW_WORKFLOW_FI_RETENTION",
              description:
                "Leads financial postings, inquiries, and period controls. Ensures balance integrity, reconciliations, and approvals under governed workflows.",
            },
            {
              accountName: "svc_sd_pricing",
              entitlementName: "Z_FI_GL_POST_ENTRY",
              description:
                "Executes powerful technical functions and integrations. Ensures change control, monitoring, and traceability under governed workflows.",
            },
            {
              accountName: "svc_fi_closing",
              entitlementName: "ZEWE_MM_REPORTS",
              description:
                "Supports utilities billing, invoicing, and collections. Ensures regulated workflows, dispute handling, and evidence under governed workflows.",
            },
            {
              accountName: "svc_audit_extract",
              entitlementName: "ZEWE:ACCOUNTING_ANALYST",
              description:
                "Directs HR transactions and worker data maintenance. Ensures accuracy, approvals, and privacy safeguards under governed workflows.",
            },
            {
              accountName: "svc_basis_monitor",
              entitlementName: "ZNEW_FICA_GEN_ENQ",
              description:
                "Executes core SAP business activities. Ensures policy-aligned execution and oversight under governed workflows.",
            },
            {
              accountName: "svc_vendor_sync",
              entitlementName: "SAP_FI_AR_CASH_POSTING",
              description:
                "Post AR cash receipts and related customer account transactions.",
            },
          ];

          const extraRowsCount = 20;
          const sapStaticRows = Array.from({ length: extraRowsCount }).map((_, index) => {
            const num = index + 1;
            const seed = orphanSummarySeed[index % orphanSummarySeed.length];
            return {
              accountName: `${seed.accountName}-${num.toString().padStart(2, "0")}`,
              entitlementName: seed.entitlementName,
              entitlementDescription:
                "Static demo service account for SAP to visually fill the grid. This row is non-functional and used only for layout purposes in the prototype.",
              description: seed.description,
              userManager: num <= 5 ? "SAP Operations" : "SAP Security",
              lastlogindate: "2024-02-0" + ((num % 9) + 1).toString(),
              businessService: "SAP",
              backupOwner: num % 2 === 0 ? "Backup SAP Owner" : "Regional SAP Owner",
              environment: num <= 4 ? "Production" : num <= 7 ? "QA" : "Development",
              pamPolicy: num <= 5 ? "High Privilege PAM Policy" : "Standard SAP PAM Policy",
              rotationPolicy: num % 2 === 0 ? "30 Days Rotation" : "45 Days Rotation",
              smeUser: "sap-team@company.com",
              continuousCompliance: true,
              reviewCycle: "Quarterly",
              entitlements: [
                {
                  entitlementName: "SAP Basis Admin",
                  entitlementDescription: "Administrative access for SAP Basis operations.",
                  lastlogindate: "2024-02-01",
                  businessService: "SAP",
                  userManager: "SAP Operations",
                },
              ],
            };
          });

          return [...items, ...sapStaticRows];
        } catch {
          return items;
        }
      };

      try {
        // Use reviewerId if available, otherwise fallback to hardcoded value (same as service account page)
        const reviewerIdToUse = reviewerId || "430ea9e6-3cff-449c-a24e-59c057f81e3d";
        const response = await fetch(
          `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getAppAccounts/${reviewerIdToUse}/service-accounts`
        );
        const data = await response.json();
        console.log("Service accounts data:", data);
        if (data.executionStatus === "success") {
          const items = withSapStaticRows(data.items || []);
          setServiceAccountsRowData(items);
          setFilteredServiceAccountsRowData(items);
        } else {
          // Add dummy data if API doesn't return success
          const dummyBaseData = [
            {
              accountName: "svc-app-account-01",
              entitlementName: "Administrator Access",
              entitlementDescription: "Full administrative access to the production database system. This entitlement grants the ability to create, modify, and delete database objects, manage user permissions, and configure system settings.",
              description: "Service account for production database management with elevated privileges. Used for automated maintenance tasks and system administration.",
              userManager: "John Doe",
              lastlogindate: "2024-01-15",
              businessService: "Production Database",
              backupOwner: "Jane Smith",
              environment: "Production",
              pamPolicy: "Standard PAM Policy",
              rotationPolicy: "30 Days Rotation",
              smeUser: "admin@company.com",
              continuousCompliance: true,
              reviewCycle: "Quarterly",
              entitlements: [
                {
                  entitlementName: "Administrator Access",
                  entitlementDescription: "Full administrative access to the production database system.",
                  lastlogindate: "2024-01-15",
                  businessService: "Production Database",
                  userManager: "John Doe",
                },
                {
                  entitlementName: "Backup Operator",
                  entitlementDescription: "Access to perform database backup operations.",
                  lastlogindate: "2024-01-14",
                  businessService: "Production Database",
                  userManager: "John Doe",
                },
              ],
            },
            {
              accountName: "svc-api-gateway-02",
              entitlementName: "Read-Only Access",
              entitlementDescription: "Read-only access to API gateway services and configuration. This entitlement allows viewing of API endpoints, monitoring metrics, and accessing logs without the ability to modify settings.",
              description: "Service account for API gateway monitoring and read-only operations. Used for automated monitoring, reporting, and analytics purposes.",
              userManager: "Mike Johnson",
              lastlogindate: "2024-01-20",
              businessService: "API Gateway Service",
              backupOwner: "Sarah Williams",
              environment: "Development",
              pamPolicy: "Basic PAM Policy",
              rotationPolicy: "60 Days Rotation",
              smeUser: "devops@company.com",
              continuousCompliance: false,
              reviewCycle: "Semi-Annual",
              entitlements: [
                {
                  entitlementName: "Read-Only Access",
                  entitlementDescription: "Read-only access to API gateway services and configuration.",
                  lastlogindate: "2024-01-20",
                  businessService: "API Gateway Service",
                  userManager: "Mike Johnson",
                },
              ],
            },
            {
              accountName: "svc-monitoring-03",
              entitlementName: "Monitoring Access",
              entitlementDescription: "Access to monitoring and alerting systems for infrastructure health checks.",
              description: "Service account used for automated monitoring and alerting across all production systems.",
              userManager: "Emily Chen",
              lastlogindate: "2024-01-18",
              businessService: "Infrastructure Monitoring",
              backupOwner: "David Lee",
              environment: "Production",
              pamPolicy: "Standard PAM Policy",
              rotationPolicy: "45 Days Rotation",
              smeUser: "ops@company.com",
              continuousCompliance: true,
              reviewCycle: "Quarterly",
              entitlements: [
                {
                  entitlementName: "Monitoring Access",
                  entitlementDescription: "Access to monitoring and alerting systems.",
                  lastlogindate: "2024-01-18",
                  businessService: "Infrastructure Monitoring",
                  userManager: "Emily Chen",
                },
                {
                  entitlementName: "Alert Management",
                  entitlementDescription: "Ability to manage and configure alerting rules.",
                  lastlogindate: "2024-01-17",
                  businessService: "Infrastructure Monitoring",
                  userManager: "Emily Chen",
                },
              ],
            },
          ];
          const items = withSapStaticRows(dummyBaseData);
          setServiceAccountsRowData(items);
          setFilteredServiceAccountsRowData(items);
        }
      } catch (error) {
        console.error("Error fetching service accounts data:", error);
        // Add dummy data on error
        const dummyBaseData = [
          {
            accountName: "svc-app-account-01",
            entitlementName: "Administrator Access",
            entitlementDescription: "Full administrative access to the production database system. This entitlement grants the ability to create, modify, and delete database objects, manage user permissions, and configure system settings.",
            description: "Service account for production database management with elevated privileges. Used for automated maintenance tasks and system administration.",
            userManager: "John Doe",
            lastlogindate: "2024-01-15",
            businessService: "Production Database",
            backupOwner: "Jane Smith",
            environment: "Production",
            pamPolicy: "Standard PAM Policy",
            rotationPolicy: "30 Days Rotation",
            smeUser: "admin@company.com",
            continuousCompliance: true,
            reviewCycle: "Quarterly",
            entitlements: [
              {
                entitlementName: "Administrator Access",
                entitlementDescription: "Full administrative access to the production database system.",
                lastlogindate: "2024-01-15",
                businessService: "Production Database",
                userManager: "John Doe",
              },
              {
                entitlementName: "Backup Operator",
                entitlementDescription: "Access to perform database backup operations.",
                lastlogindate: "2024-01-14",
                businessService: "Production Database",
                userManager: "John Doe",
              },
            ],
          },
          {
            accountName: "svc-api-gateway-02",
            entitlementName: "Read-Only Access",
            entitlementDescription: "Read-only access to API gateway services and configuration. This entitlement allows viewing of API endpoints, monitoring metrics, and accessing logs without the ability to modify settings.",
            description: "Service account for API gateway monitoring and read-only operations. Used for automated monitoring, reporting, and analytics purposes.",
            userManager: "Mike Johnson",
            lastlogindate: "2024-01-20",
            businessService: "API Gateway Service",
            backupOwner: "Sarah Williams",
            environment: "Development",
            pamPolicy: "Basic PAM Policy",
            rotationPolicy: "60 Days Rotation",
            smeUser: "devops@company.com",
            continuousCompliance: false,
            reviewCycle: "Semi-Annual",
            entitlements: [
              {
                entitlementName: "Read-Only Access",
                entitlementDescription: "Read-only access to API gateway services and configuration.",
                lastlogindate: "2024-01-20",
                businessService: "API Gateway Service",
                userManager: "Mike Johnson",
              },
            ],
          },
          {
            accountName: "svc-monitoring-03",
            entitlementName: "Monitoring Access",
            entitlementDescription: "Access to monitoring and alerting systems for infrastructure health checks.",
            description: "Service account used for automated monitoring and alerting across all production systems.",
            userManager: "Emily Chen",
            lastlogindate: "2024-01-18",
            businessService: "Infrastructure Monitoring",
            backupOwner: "David Lee",
            environment: "Production",
            pamPolicy: "Standard PAM Policy",
            rotationPolicy: "45 Days Rotation",
            smeUser: "ops@company.com",
            continuousCompliance: true,
            reviewCycle: "Quarterly",
            entitlements: [
              {
                entitlementName: "Monitoring Access",
                entitlementDescription: "Access to monitoring and alerting systems.",
                lastlogindate: "2024-01-18",
                businessService: "Infrastructure Monitoring",
                userManager: "Emily Chen",
              },
              {
                entitlementName: "Alert Management",
                entitlementDescription: "Ability to manage and configure alerting rules.",
                lastlogindate: "2024-01-17",
                businessService: "Infrastructure Monitoring",
                userManager: "Emily Chen",
              },
            ],
          },
        ];
        const items = withSapStaticRows(dummyBaseData);
        setServiceAccountsRowData(items);
        setFilteredServiceAccountsRowData(items);
      }
    };
    fetchServiceAccountsData();
  }, [reviewerId]);

  // Filter service accounts based on search query
  useEffect(() => {
    if (!serviceAccountsSearchQuery.trim()) {
      setFilteredServiceAccountsRowData(serviceAccountsRowData);
    } else {
      const searchLower = serviceAccountsSearchQuery.toLowerCase();
      const filtered = serviceAccountsRowData.filter((item: any) => {
        const accountName = (item.accountName || "").toLowerCase();
        const entitlementName = (item.entitlementName || "").toLowerCase();
        const userManager = (item.userManager || item.custodian || "").toLowerCase();
        const businessService = (item.businessService || item.applicationName || item.businessUnit || "").toLowerCase();
        
        return (
          accountName.includes(searchLower) ||
          entitlementName.includes(searchLower) ||
          userManager.includes(searchLower) ||
          businessService.includes(searchLower)
        );
      });
      setFilteredServiceAccountsRowData(filtered);
    }
  }, [serviceAccountsSearchQuery, serviceAccountsRowData]);

  // Restore focus after component updates if input was focused
  useEffect(() => {
    if (isSearchInputFocused && accountsSearchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        accountsSearchInputRef.current?.focus();
        // Restore cursor position if possible
        const input = accountsSearchInputRef.current;
        if (input && input.selectionStart !== null) {
          const cursorPos = input.value.length;
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }
  }, [filteredAccountsRowData, isSearchInputFocused]);

  useEffect(() => {
    const fetchEntitlementsData = async () => {
      try {
        const entReviewerId =
          reviewerId?.trim() || "ec527a50-0944-4b31-b239-05518c87a743";
        const response = await fetch(
          `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getAppEntitlements/${encodeURIComponent(
            entReviewerId
          )}/${encodeURIComponent(id)}`
        );
        const data = await response.json();
        console.log("Entitlements data:", data);
        if (data.executionStatus === "success") {
          console.log("Entitlements items:", data.items);
          if (data.items && data.items.length > 0) {
            console.log("First entitlement item:", data.items[0]);
            console.log(
              "Available fields in first item:",
              Object.keys(data.items[0])
            );

            // Apply mapping to each entitlement item to map catalogDetails.risk
            const mappedItems = data.items.map((item: any) => {
              if (item.catalogDetails) {
                return mapApiDataToNodeData(item.catalogDetails, item);
              }
              return item;
            });
            setEntRowData(mappedItems);
          } else {
            setEntRowData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching entitlements data:", error);
      }
    };
    if (tabIndex === 2) {
      // Only fetch entitlements when on the Entitlements tab
      fetchEntitlementsData();
    }
  }, [id, tabIndex, reviewerId]);

  //   {
  //     "Ent ID": "ENT201",
  //     "Ent Name": "Server Admin",
  //     "Ent Description":
  //       "Administrative access to on-premises server infrastructure",
  //     "Total Assignments": 8,
  //     "Last Sync": "2025-07-13T12:00:00Z",
  //     Requestable: "Yes",
  //     Certifiable: "Yes",
  //     Risk: "High",
  //     "SOD Check": "Passed",
  //     Hierarchy: "Top-level",
  //     "Pre- Requisite": "Server Admin Training",
  //     "Pre-Requisite Details": "Completion of Windows Server Admin course",
  //     "Revoke on Disable": "Yes",
  //     "Shared Pwd": "No",
  //     "Capability/Technical Scope": "Manage server configurations and updates",
  //     "Business Objective": "Maintain server uptime and security",
  //     "Compliance Type": "ISO 27001",
  //     "Access Scope": "Global",
  //     "Last Reviewed on": "2025-06-25",
  //     Reviewed: "Yes",
  //     "Dynamic Tag": "Infrastructure",
  //     "MFA Status": "Enabled",
  //     "Review Schedule": "Quarterly",
  //     "Ent Owner": "Emily Carter",
  //     "Created On": "2024-03-10",
  //   },
  //   {
  //     "Ent ID": "ENT202",
  //     "Ent Name": "HR Viewer",
  //     "Ent Description": "Read-only access to HR system reports",
  //     "Total Assignments": 20,
  //     "Last Sync": "2025-07-12T15:30:00Z",
  //     Requestable: "No",
  //     Certifiable: "No",
  //     Risk: "Low",
  //     "SOD Check": "Not Required",
  //     Hierarchy: "Low-level",
  //     "Pre- Requisite": "None",
  //     "Pre-Requisite Details": "N/A",
  //     "Revoke on Disable": "Yes",
  //     "Shared Pwd": "Yes",
  //     "Capability/Technical Scope": "View employee data and reports",
  //     "Business Objective": "Support HR analytics",
  //     "Compliance Type": "GDPR",
  //     "Access Scope": "Departmental",
  //     "Last Reviewed on": "2025-05-15",
  //     Reviewed: "No",
  //     "Dynamic Tag": "HR",
  //     "MFA Status": "Disabled",
  //     "Review Schedule": "Annual",
  //     "Ent Owner": "Mark Thompson",
  //     "Created On": "2024-08-01",
  //   },
  // ];

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "accountName",
        headerName: "Account",
        flex: 2,
        // cellRenderer: "agGroupCellRenderer",
        cellRendererParams: {
          suppressExpand: false,
          innerRenderer: (params: ICellRendererParams) => {
            const { accountType } = params.data || {};
            const accountTypeLabel = accountType;
            return (
              <div className="flex items-center space-x-2">
                <div className="flex flex-col gap-0 cursor-pointer hover:underline">
                  <span className="text-md font-large text-gray-800">
                    {params.value}{" "}
                    {accountType && (
                      <span
                        className="text-[#175AE4] font-normal"
                        title={`Account Type: ${accountType}`}
                      >
                        {accountTypeLabel}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          },
        },
        // cellClass: "ag-cell-no-padding",
      },
      {
        field: "Risk",
        headerName: "Risk",
        width: 100,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => {
          const risk = params.data?.Risk || params.data?.risk || "Unknown";
          const riskInitial =
            risk === "High" ? "H" : risk === "Medium" ? "M" : "L";
          const riskColor =
            risk === "High" ? "red" : risk === "Medium" ? "orange" : "green";

          // Special styling for High risk - show in red bubble
          if (risk === "High") {
            return (
              <div className="flex items-center">
                <span
                  className="px-3 py-1 text-gray-800 font-medium rounded-full"
                  style={{
                    backgroundColor: "#ffebee",
                    color: "#d32f2f",
                    border: "1px solid #ffcdd2",
                  }}
                >
                  {risk}
                </span>
              </div>
            );
          }

          // Special styling for Low risk - show in green bubble
          if (risk === "Low") {
            return (
              <div className="flex items-center">
                <span
                  className="px-3 py-1 text-gray-800 font-medium rounded-full"
                  style={{
                    backgroundColor: "#e8f5e8",
                    color: "#2e7d32",
                    border: "1px solid #c8e6c9",
                  }}
                >
                  {risk}
                </span>
              </div>
            );
          }

          // Default styling for Medium risk
          return (
            <div className="flex items-center">
              <span
                className="px-2 py-1 text-xs rounded font-medium"
                style={{ backgroundColor: riskColor, color: "white" }}
              >
                {riskInitial}
              </span>
            </div>
          );
        },
      },
      {
        field: "userDisplayName",
        headerName: "Identity",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => {
          const { userType } = params.data || {};
          const userTypeLabel = userType ? `(${userType})` : "";
          return (
            <div className="flex flex-col gap-0 cursor-pointer hover:underline">
              <span className="text-md text-gray-800">
                {params.value}{" "}
                {userType && (
                  <span
                    className="text-[#175AE4] "
                    title={`User Type: ${userType}`}
                  >
                    {userTypeLabel}
                  </span>
                )}
              </span>
            </div>
          );
        },
      },
      {
        field: "entitlementName",
        headerName: "Entitlement",
        enableRowGroup: true,
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value}</span>
          </div>
        ),
      },
      {
        field: "lastlogindate",
        headerName: "Last Login",
        enableRowGroup: true,
        valueFormatter: (params: ICellRendererParams) =>
          formatDateMMDDYY(params.value),
      },
      {
        field: "lastAccessReview",
        headerName: "Last Review",
        valueFormatter: (params: ICellRendererParams) =>
          formatDateMMDDYY(params.value),
      },
      {
        field: "accountType",
        headerName: "Account Type",
        flex: 2,
        hide: true,
      },
      { field: "userStatus", headerName: "User Status", flex: 2, hide: true },
      { field: "userId", headerName: "User ID", flex: 2, hide: true },
      {
        field: "userManager",
        headerName: "User Manager",
        flex: 2,
        hide: true,
      },
      { field: "userDepartment", headerName: "User Dept", flex: 2, hide: true },
      { field: "jobTitle", headerName: "Job Title", flex: 2, hide: true },
      {
        field: "accessGrantDate",
        headerName: "Access Grant Date",
        flex: 2,
        hide: true,
        valueFormatter: (params: ICellRendererParams) =>
          formatDateMMDDYY(params.value),
      },
      { field: "userType", headerName: "User Type", flex: 2, hide: true },
      {
        field: "entitlementType",
        headerName: "Entitlement Type",
        flex: 2,
        hide: true,
      },
      {
        field: "syncDate",
        headerName: "Sync Date",
        flex: 1,
        valueFormatter: (params: ICellRendererParams) =>
          formatDateMMDDYY(params.value),
      },
      {
        field: "__action__",
        headerName: "Action",
        width: 100,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex items-center h-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="Edit"
              aria-label="Edit account"
              onClick={() => {
                const row = params?.data || {};
                const EditAccountSidebar = () => {
                  const [accountType, setAccountType] = useState("");
                  const [changeOwner, setChangeOwner] = useState(false);

                  // Assign Account Owner state (inline copy of modal content)
                  const [ownerType, setOwnerType] = useState<"User" | "Group">("User");
                  const [selectedAttribute, setSelectedAttribute] = useState<string>("username");
                  const [searchValue, setSearchValue] = useState("");
                  const [selectedItem, setSelectedItem] = useState<Record<string, string> | null>(null);

                  const users: Record<string, string>[] = [
                    { username: "john", email: "john@example.com", role: "admin" },
                    { username: "jane", email: "jane@example.com", role: "user" },
                  ];
                  const groups: Record<string, string>[] = [
                    { name: "admins", email: "admins@corp.com", role: "admin" },
                    { name: "devs", email: "devs@corp.com", role: "developer" },
                  ];
                  const userAttributes = [
                    { value: "username", label: "Username" },
                    { value: "email", label: "Email" },
                  ];
                  const groupAttributes = [
                    { value: "name", label: "Group Name" },
                    { value: "role", label: "Role" },
                  ];
                  const sourceData = ownerType === "User" ? users : groups;
                  const currentAttributes = ownerType === "User" ? userAttributes : groupAttributes;
                  const filteredData =
                    searchValue.trim() === ""
                      ? []
                      : sourceData.filter((item) => {
                          const value = item[selectedAttribute];
                          return value?.toLowerCase().includes(searchValue.toLowerCase());
                        });
                  
                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                          <div className="text-sm text-gray-700 break-words">
                            {row.userDisplayName || "-"} → {row.accountName || "-"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Account Type</label>
                          <select 
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value=""></option>
                            <option value="Regular">Regular</option>
                            <option value="Orphan">Orphan</option>
                            <option value="Service">Service</option>
                          </select>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-700">Change Account Owner</span>
                          <span className="text-sm text-gray-900">No</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={changeOwner}
                              onChange={(e) => setChangeOwner(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
                          </label>
                          <span className="text-sm text-gray-900">Yes</span>
                        </div>
                        {changeOwner && (
                          <div className="mt-2">
                            <div className="flex mt-3 bg-gray-100 p-1 rounded-md">
                              {(["User", "Group"] as const).map((type) => (
                                <button
                                  key={type}
                                  className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors ${
                                    ownerType === type
                                      ? "bg-white text-[#15274E] border border-gray-300 shadow-sm relative z-10 rounded-md"
                                      : "bg-transparent text-gray-500 hover:text-gray-700 rounded-md"
                                  }`}
                                  onClick={() => {
                                    setOwnerType(type);
                                    const initialAttr = type === "User" ? userAttributes[0] : groupAttributes[0];
                                    setSelectedAttribute(initialAttr?.value || "");
                                    setSearchValue("");
                                    setSelectedItem(null);
                                  }}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Select Attribute</label>
                              <div className="relative">
                                <select
                                  value={selectedAttribute}
                                  onChange={(e) => setSelectedAttribute(e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {currentAttributes.map((attr) => (
                                    <option key={attr.value} value={attr.value}>
                                      {attr.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Search Value</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input type="text" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Search" />
                              </div>
                            </div>
                            {searchValue.trim() !== "" && (
                              <div className="max-h-36 overflow-auto border rounded p-2 mt-3 text-sm bg-gray-50">
                                {filteredData.length === 0 ? (
                                  <p className="text-gray-500 italic">No results found.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {filteredData.map((item, index) => (
                                      <li key={index} className={`p-2 border rounded cursor-pointer transition-colors ${selectedItem === item ? "bg-blue-100 border-blue-300" : "hover:bg-gray-100"}`} onClick={() => {
                                        setSelectedItem(item);
                                        setSearchValue(item[selectedAttribute]);
                                      }}>
                                        {Object.values(item).join(" | ")}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex justify-center items-center p-3 border-t border-gray-200 bg-gray-50 min-h-[60px]">
                        <button 
                          onClick={() => { 
                            // Handle save logic here
                            console.log("Save clicked", { accountType, changeOwner, selectedItem });
                          }} 
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                };
                
                openSidebar(<EditAccountSidebar />, { widthPx: 450 });
              }}
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  // Service accounts column definitions
  const serviceAccountsColumnDefs = useMemo<ColDef[]>(
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
            <span className="text-md text-gray-800">{params.value || params.data?.custodian || "-"}</span>
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
          <div className="flex items-center gap-2 h-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="Edit"
              aria-label="Edit account"
              onClick={() => {
                const row = params?.data || {};
                const EditAccountSidebar = () => {
                  const [accountType, setAccountType] = useState("");
                  const [changeOwner, setChangeOwner] = useState(false);
                  const [ownerType, setOwnerType] = useState<"User" | "Group">("User");
                  const [selectedAttribute, setSelectedAttribute] = useState<string>("username");
                  const [searchValue, setSearchValue] = useState("");
                  const [selectedItem, setSelectedItem] = useState<Record<string, string> | null>(null);

                  const users: Record<string, string>[] = [
                    { username: "john", email: "john@example.com", role: "admin" },
                    { username: "jane", email: "jane@example.com", role: "user" },
                  ];
                  const groups: Record<string, string>[] = [
                    { name: "admins", email: "admins@corp.com", role: "admin" },
                    { name: "devs", email: "devs@corp.com", role: "developer" },
                  ];
                  const userAttributes = [
                    { value: "username", label: "Username" },
                    { value: "email", label: "Email" },
                  ];
                  const groupAttributes = [
                    { value: "name", label: "Group Name" },
                    { value: "role", label: "Role" },
                  ];
                  const sourceData = ownerType === "User" ? users : groups;
                  const currentAttributes = ownerType === "User" ? userAttributes : groupAttributes;
                  const filteredData =
                    searchValue.trim() === ""
                      ? []
                      : sourceData.filter((item) => {
                          const value = item[selectedAttribute];
                          return value?.toLowerCase().includes(searchValue.toLowerCase());
                        });
                  
                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                          <div className="text-sm text-gray-700 break-words">
                            {row.accountName || "-"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Account Type</label>
                          <select 
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value=""></option>
                            <option value="Regular">Regular</option>
                            <option value="Orphan">Orphan</option>
                            <option value="Service">Service</option>
                          </select>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-700">Change Account Owner</span>
                          <span className="text-sm text-gray-900">No</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={changeOwner}
                              onChange={(e) => setChangeOwner(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
                          </label>
                          <span className="text-sm text-gray-900">Yes</span>
                        </div>
                        {changeOwner && (
                          <div className="mt-2">
                            <div className="flex mt-3 bg-gray-100 p-1 rounded-md">
                              {(["User", "Group"] as const).map((type) => (
                                <button
                                  key={type}
                                  className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors ${
                                    ownerType === type
                                      ? "bg-white text-[#15274E] border border-gray-300 shadow-sm relative z-10 rounded-md"
                                      : "bg-transparent text-gray-500 hover:text-gray-700 rounded-md"
                                  }`}
                                  onClick={() => {
                                    setOwnerType(type);
                                    const initialAttr = type === "User" ? userAttributes[0] : groupAttributes[0];
                                    setSelectedAttribute(initialAttr?.value || "");
                                    setSearchValue("");
                                    setSelectedItem(null);
                                  }}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Select Attribute</label>
                              <div className="relative">
                                <select
                                  value={selectedAttribute}
                                  onChange={(e) => setSelectedAttribute(e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {currentAttributes.map((attr) => (
                                    <option key={attr.value} value={attr.value}>
                                      {attr.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Search Value</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input type="text" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Search" />
                              </div>
                            </div>
                            {searchValue.trim() !== "" && (
                              <div className="max-h-36 overflow-auto border rounded p-2 mt-3 text-sm bg-gray-50">
                                {filteredData.length === 0 ? (
                                  <p className="text-gray-500 italic">No results found.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {filteredData.map((item, index) => (
                                      <li key={index} className={`p-2 border rounded cursor-pointer transition-colors ${selectedItem === item ? "bg-blue-100 border-blue-300" : "hover:bg-gray-100"}`} onClick={() => {
                                        setSelectedItem(item);
                                        setSearchValue(item[selectedAttribute]);
                                      }}>
                                        {Object.values(item).join(" | ")}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex justify-center items-center p-3 border-t border-gray-200 bg-gray-50 min-h-[60px]">
                        <button 
                          onClick={() => { 
                            console.log("Save clicked", { accountType, changeOwner, selectedItem });
                          }} 
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                };
                
                openSidebar(<EditAccountSidebar />, { widthPx: 450 });
              }}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const row = params?.data || {};
                const InfoSidebar = () => {
                  const [sectionsOpen, setSectionsOpen] = useState({
                    general: true,
                  });
                  const scrollContainerRef = useRef<HTMLDivElement>(null);

                  useEffect(() => {
                    if (scrollContainerRef.current) {
                      const style = document.createElement('style');
                      style.id = 'hide-scrollbar-style';
                      if (!document.getElementById('hide-scrollbar-style')) {
                        style.textContent = `
                          .sidebar-scroll-container::-webkit-scrollbar {
                            display: none;
                          }
                        `;
                        document.head.appendChild(style);
                      }
                    }
                  }, []);

                  return (
                    <div className="flex flex-col h-full">
                      <div 
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto sidebar-scroll-container"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        <div className="p-4 border-b bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="mt-0">
                                <span className="text-xs uppercase text-gray-500">
                                  Account:
                                </span>
                                <div className="text-md font-medium break-words break-all whitespace-normal max-w-full">
                                  {row.accountName || "-"}
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="text-xs uppercase text-gray-500">
                                  Entitlement:
                                </span>
                                <div className="text-md font-medium break-words break-all whitespace-normal max-w-full">
                                  {row.entitlementName || "-"}
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="text-xs uppercase text-gray-500">
                                  Description:
                                </span>
                                <p className="text-sm text-gray-700 break-words break-all whitespace-pre-wrap max-w-full">
                                  {row.entitlementDescription || row.entitlement_description || row.description || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                            <button
                              className="flex items-center justify-between w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                              onClick={() =>
                                setSectionsOpen((s: any) => ({ ...s, general: !s.general }))
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
                                    <label className="text-xs uppercase text-gray-500 font-medium">Custodian</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.userManager || row.custodian || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Last Login</label>
                                    <div className="text-sm text-gray-900 mt-1">
                                      {row.lastlogindate ? formatDateMMDDYY(row.lastlogindate) : "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Business Service</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.businessService || row.applicationName || row.businessUnit || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Environment</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.environment || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Backup Owner</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.backupOwner || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">SME User</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.smeUser || row.sme_user || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">PAM Policy</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.pamPolicy || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Rotation Policy</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.rotationPolicy || row.rotation_policy || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Continuous Compliance</label>
                                    <div className="text-sm text-gray-900 mt-1">
                                      {row.continuousCompliance === true || row.continuousCompliance === "true" || row.continuousCompliance === "Y" || row.continuous_compliance === true ? "Yes" : "No"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Review Cycle</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.reviewCycle || row.review_cycle || "N/A"}
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
                
                openSidebar(<InfoSidebar />, {
                  widthPx: 500,
                  title: "Service Account Details",
                });
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="Info"
              aria-label="View account details"
            >
              <ArrowRight
                color="#55544dff"
                size={20}
                className="transform scale-[0.9]"
              />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  // Service accounts entitlements detail column definitions
  const serviceAccountsEntitlementsColumnDefs = useMemo<ColDef[]>(
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
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-sm text-gray-700 break-words">
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
            <span className="text-md text-gray-800">{params.value || params.data?.custodian || "-"}</span>
          </div>
        ),
      },
    ],
    []
  );

  // Service accounts detail cell renderer params
  const serviceAccountsDetailCellRendererParams = useMemo(() => {
    return {
      detailGridOptions: {
        columnDefs: serviceAccountsEntitlementsColumnDefs,
        defaultColDef: {
          sortable: true,
          filter: true,
          resizable: true,
          flex: 1,
          wrapText: true,
          autoHeight: true,
        },
        domLayout: "autoHeight" as const,
        headerHeight: 40,
      },
      getDetailRowData: (params: any) => {
        // Each service account row has entitlement data
        const serviceAccount = params.data;
        console.log("Service account data for detail:", serviceAccount);
        
        // If the service account has multiple entitlements in an array, use those
        if (Array.isArray(serviceAccount.entitlements) && serviceAccount.entitlements.length > 0) {
          console.log("Using entitlements array:", serviceAccount.entitlements);
          params.successCallback(serviceAccount.entitlements);
        } else {
          // Create an array with the entitlement information from the service account itself
          const entitlements = [];
          
          if (serviceAccount.entitlementName) {
            entitlements.push({
              entitlementName: serviceAccount.entitlementName,
              entitlementDescription: serviceAccount.entitlementDescription || serviceAccount.description || "",
              lastlogindate: serviceAccount.lastlogindate,
              businessService: serviceAccount.businessService || serviceAccount.applicationName || serviceAccount.businessUnit,
              userManager: serviceAccount.userManager || serviceAccount.custodian,
            });
          }
          
          console.log("Created entitlements from service account:", entitlements);
          if (entitlements.length > 0) {
            params.successCallback(entitlements);
          } else {
            // Return empty array if no entitlements found
            params.successCallback([]);
          }
        }
      },
    };
  }, [serviceAccountsEntitlementsColumnDefs]);

  const DetailCellRenderer = (props: IDetailCellRendererParams) => {
    const { data } = props;
    return (
      <div className="flex p-4 bg-gray-50 border-t border-gray-200 ml-10">
        <div className="flex flex-row items-center gap-2">
          <span className="text-gray-800">{data.description}</span>
        </div>
      </div>
    );
  };
  const colDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "entitlementName",
        headerName: "Entitlement",
        flex: 3,
        minWidth: 200,
        wrapText: true,
        autoHeight: true,
        colSpan: (params) => {
          if (!params.data?.__isDescRow) return 1;
          try {
            const center =
              (params.api as any)?.getDisplayedCenterColumns?.() || [];
            const left = (params.api as any)?.getDisplayedLeftColumns?.() || [];
            const right =
              (params.api as any)?.getDisplayedRightColumns?.() || [];
            const total = center.length + left.length + right.length;
            if (total > 0) return total;
          } catch {}
          const all =
            (params as any)?.columnApi?.getAllDisplayedColumns?.() || [];
          return all.length || 1;
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.__isDescRow) {
            return (
              <div className="text-gray-600 text-sm w-full break-words whitespace-pre-wrap">
                {params.data?.["Ent Description"] ||
                  params.data?.description ||
                  params.data?.entitlementDescription ||
                  "-"}
              </div>
            );
          }

          const risk = params.data?.risk || params.data?.Risk;
          const isRiskHigh = risk === "High";

          return isRiskHigh ? (
            <div className="flex items-center h-full">
              <span
                className="px-2 py-1 text-sm font-medium rounded-full inline-flex items-center cursor-pointer hover:bg-red-200 transition-colors duration-200 break-words whitespace-normal"
                style={{
                  backgroundColor: "#ffebee",
                  color: "#d32f2f",
                  border: "1px solid #ffcdd2",
                  minHeight: "24px",
                }}
                title="High Risk - Click for details"
                onClick={() => {
                  const appNameForCheck = (
                    params.data?.["App Name"] ||
                    params.data?.applicationName ||
                    ""
                  ).toString();
                  const isOciApp = appNameForCheck
                    .toLowerCase()
                    .includes("oci");
                  if (!isOciApp) {
                    return;
                  }
                  setSelectedEntitlement({
                    name: params.value,
                    description: params.data?.description,
                    type: params.data?.type,
                    applicationName:
                      params.data?.["App Name"] || params.data?.applicationName,
                    risk: params.data?.risk || params.data?.Risk,
                    lastReviewed: params.data?.["Last Reviewed on"],
                    lastSync: params.data?.["Last Sync"],
                    appInstanceId:
                      params.data?.applicationInstanceId ||
                      params.data?.appInstanceId,
                    entitlementId:
                      params.data?.entitlementId || params.data?.id,
                  });
                  openSidebar(
                    <PolicyRiskDetails
                      entitlementData={{
                        name:
                          params.data?.name ||
                          params.data?.entitlementName ||
                          "N/A",
                        description: params.data?.description,
                        type: params.data?.type,
                        applicationName: params.data?.applicationName,
                        risk: params.data?.risk ?? params.data?.risk_level,
                        lastReviewed: params.data?.["Last Reviewed on"],
                        lastSync: params.data?.["Last Sync"],
                        appInstanceId: params.data?.appInstanceId,
                        entitlementId:
                          params.data?.entitlementId || params.data?.id,
                      }}
                    />,
                    { widthPx: 500 }
                  );
                }}
              >
                {params.value}
              </span>
            </div>
          ) : (
            <div className="font-semibold break-words whitespace-normal">
              {params.value}
            </div>
          );
        },
      },
      // { field:"Ent Description", headerName:"Entitlement Description", flex:2},
      { field: "type", headerName: "Type", flex: 1, minWidth: 150 },
      {
        field: "Ent Owner",
        headerName: "Entitlement owner",
        flex: 1,
        minWidth: 150,
      },
      {
        field: "Risk",
        headerName: "Risk",
        width: 120,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => {
          const risk = params.value || params.data?.Risk || params.data?.risk;
          const riskColor =
            risk === "High" ? "red" : risk === "Medium" ? "orange" : "green";
          return (
            <span className="font-medium" style={{ color: riskColor }}>
              {risk}
            </span>
          );
        },
      },
      {
        field: "applicationName",
        headerName: "Application",
        width: 150,
        hide: true,
      },
      { field: "assignment", headerName: "Assignment", width: 150, hide: true },
      {
        field: "Last Sync",
        headerName: "Last Sync",
        flex: 1,
        minWidth: 150,
        valueGetter: () => "2026-07-21",
        valueFormatter: (params: ICellRendererParams) =>
          formatDateMMDDYY(params.value),
      },
      {
        field: "Last Reviewed on",
        headerName: "Last Reviewed",
        flex: 1,
        minWidth: 150,
        valueFormatter: (params: ICellRendererParams) =>
          formatDateMMDDYY(params.value),
      },
      {
        field: "Total Assignments",
        headerName: "Total Assignments",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Requestable",
        headerName: "Requestable",
        width: 100,
        hide: true,
      },
      {
        field: "Certifiable",
        headerName: "Certifiable",
        width: 100,
        hide: true,
      },
      { field: "SOD Check", headerName: "SOD Check", flex: 1.5, hide: true },
      { field: "Hierarchy", headerName: "Hierarchy", width: 100, hide: true },
      {
        field: "Pre- Requisite",
        headerName: "Pre- Requisite",
        width: 100,
        hide: true,
      },
      {
        field: "Pre-Requisite Details",
        headerName: "Pre-Requisite Details",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Revoke on Disable",
        headerName: "Revoke on Disable",
        flex: 1.5,
        hide: true,
      },
      { field: "Shared Pwd", headerName: "Shared Pwd", flex: 1.5, hide: true },
      {
        field: "Capability/Technical Scope",
        headerName: "Capability/Technical Scope",
        width: 100,
        hide: true,
      },
      {
        field: "Business Objective",
        headerName: "Busines Objective",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Compliance Type",
        headerName: "Compliance Type",
        width: 100,
        hide: true,
      },
      {
        field: "Access Scope",
        headerName: "Access Scope",
        flex: 1.5,
        hide: true,
      },
      { field: "Reviewed", headerName: "Reviewed", width: 100, hide: true },
      {
        field: "Dynamic Tag",
        headerName: "Dynamic Tag",
        width: 100,
        hide: true,
      },
      { field: "MFA Status", headerName: "MFA Status", flex: 1.5, hide: true },
      {
        field: "Review Schedule",
        headerName: "Review Schedule",
        width: 100,
        hide: true,
      },
      {
        field: "Created On",
        headerClass: "Created On",
        width: 100,
        hide: true,
      },
      {
        field: "arrowColumn",
        headerName: "",
        width: 60,
        maxWidth: 60,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.__isDescRow) return null;
          return (
            <div className="flex items-center justify-center h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSidePanel(params.data);
                }}
                className="cursor-pointer hover:opacity-80 transition-opacity p-1"
                title="View details"
                aria-label="View entitlement details"
              >
                <ChevronRight
                  className="w-5 h-5 text-gray-600"
                />
              </button>
            </div>
          );
        },
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "right",
        lockPinned: true,
      },
    ],
    [reviewerId, toggleSidePanel]
  );

  const underReviewColDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "entitlementName",
        headerName: "Entitlement Name",
        width: 550,
        wrapText: true,
        autoHeight: true,
        colSpan: (params) => {
          if (!params.data?.__isDescRow) return 1;
          try {
            const center =
              (params.api as any)?.getDisplayedCenterColumns?.() || [];
            const left = (params.api as any)?.getDisplayedLeftColumns?.() || [];
            const right =
              (params.api as any)?.getDisplayedRightColumns?.() || [];
            const total = center.length + left.length + right.length;
            if (total > 0) return total;
          } catch {}
          const all =
            (params as any)?.columnApi?.getAllDisplayedColumns?.() || [];
          return all.length || 1;
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.__isDescRow) {
            return (
              <div className="text-gray-600 text-sm w-full break-words whitespace-pre-wrap">
                {params.data?.["Ent Description"] ||
                  params.data?.description ||
                  params.data?.entitlementDescription ||
                  "-"}
              </div>
            );
          }

          const risk = params.data?.risk || params.data?.Risk;
          const isRiskHigh = risk === "High";

          return isRiskHigh ? (
            <div className="flex items-center h-full">
              <span
                className="px-2 py-1 text-sm font-medium rounded-full inline-flex items-center cursor-pointer hover:bg-red-200 transition-colors duration-200 break-words whitespace-normal"
                style={{
                  backgroundColor: "#ffebee",
                  color: "#d32f2f",
                  border: "1px solid #ffcdd2",
                  minHeight: "24px",
                }}
                title="High Risk - Click for details"
                onClick={() => {
                  const appNameForCheck = (
                    params.data?.["App Name"] ||
                    params.data?.applicationName ||
                    ""
                  ).toString();
                  const isOciApp = appNameForCheck
                    .toLowerCase()
                    .includes("oci");
                  if (!isOciApp) {
                    return;
                  }
                  setSelectedEntitlement({
                    name: params.value,
                    description: params.data?.description,
                    type: params.data?.type,
                    applicationName:
                      params.data?.["App Name"] || params.data?.applicationName,
                    risk: params.data?.risk || params.data?.Risk,
                    lastReviewed: params.data?.["Last Reviewed on"],
                    lastSync: params.data?.["Last Sync"],
                    appInstanceId:
                      params.data?.applicationInstanceId ||
                      params.data?.appInstanceId,
                    entitlementId:
                      params.data?.entitlementId || params.data?.id,
                  });
                  openSidebar(
                    <PolicyRiskDetails
                      entitlementData={{
                        name:
                          params.data?.name ||
                          params.data?.entitlementName ||
                          "N/A",
                        description: params.data?.description,
                        type: params.data?.type,
                        applicationName: params.data?.applicationName,
                        risk: params.data?.risk ?? params.data?.risk_level,
                        lastReviewed: params.data?.["Last Reviewed on"],
                        lastSync: params.data?.["Last Sync"],
                        appInstanceId: params.data?.appInstanceId,
                        entitlementId:
                          params.data?.entitlementId || params.data?.id,
                      }}
                    />,
                    { widthPx: 500 }
                  );
                }}
              >
                {params.value}
              </span>
            </div>
          ) : (
            <div className="font-semibold break-words whitespace-normal">
              {params.value}
            </div>
          );
        },
      },
      { field: "type", headerName: "Type", width: 250 },
      {
        field: "Risk",
        headerName: "Risk",
        width: 120,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => {
          const risk = params.value || params.data?.Risk || params.data?.risk;
          const riskColor =
            risk === "High" ? "red" : risk === "Medium" ? "orange" : "green";
          return (
            <span className="font-medium" style={{ color: riskColor }}>
              {risk}
            </span>
          );
        },
      },
      { field: "applicationName", headerName: "Application", width: 250 },
      { field: "Last Reviewed on", headerName: "Last Reviewed", width: 200 },
      {
        headerName: "Actions",
        width: 250,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <div className="flex space-x-4 h-full items-start">
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <button
                onClick={handleApprove}
                title="Approve"
                aria-label="Approve selected rows"
                className={`p-1 rounded transition-colors duration-200 ${
                  lastAction === "Approve"
                    ? "bg-green-500"
                    : "hover:bg-green-100"
                }`}
              >
                <CircleCheck
                  className="cursor-pointer"
                  color="#1c821cff"
                  strokeWidth="1"
                  size="32"
                  fill={lastAction === "Approve" ? "#1c821cff" : "none"}
                />
              </button>
              <button
                onClick={handleRevoke}
                title="Revoke"
                aria-label="Revoke selected rows"
                className={`p-1 rounded ${
                  nodeData?.status === "Rejected" ? "bg-red-100" : ""
                }`}
              >
                <CircleX
                  className="cursor-pointer hover:opacity-80 transform rotate-90"
                  color="#FF2D55"
                  strokeWidth="1"
                  size="32"
                  fill={nodeData?.status === "Rejected" ? "#FF2D55" : "none"}
                />
              </button>
              <button
                onClick={(e) => {
                  setNodeData(params.data);
                  handleComment(e);
                }}
                title="Comment"
                aria-label="Add comment"
                className="p-1 rounded"
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 32 32"
                  className="cursor-pointer hover:opacity-80"
                >
                  <path
                    d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
                    fill="#2684FF"
                  />
                </svg>
              </button>
              <button
                onClick={() => toggleSidePanel(params.data)}
                title="Info"
                className="cursor-pointer rounded-sm hover:opacity-80"
                aria-label="View details"
              >
                <ArrowRightCircle
                  color="#2563eb"
                  size="36"
                  className="transform scale-[0.8]"
                />
              </button>
            </div>
          );
        },
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
      },
    ],
    []
  );

  const detailCellRendererParams = useMemo(() => {
    return {
      detailGridOptions: {
        columnDefs: [{ field: "info", headerName: "Detail Info", flex: 1 }],
        defaultColDef: {
          flex: 1,
        },
      },
      getDetailRowData: (params: any) => {
        params.successCallback([{ info: params.data.details }]);
      },
    };
  }, []);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 100,
    }),
    []
  );

  const tabsDataEnt = useMemo(() => [
    {
      label: "All",
      icon: ChevronDown,
      iconOff: ChevronUp,
      component: () => {
        return (
          <div
            className="ag-theme-alpine"
            style={{ width: "100%", minWidth: 0 }}
          >
            {/* <div className="relative mb-2">
              <Accordion
                iconClass="top-1 right-0 rounded-full text-white bg-purple-800"
                open={true}
              >
                <div className="grid grid-cols-4 gap-10">
                  {Object.entries(data).map(([category, items]) => (
                    <div key={category}>
                      <div className="flex justify-between items-center mb-2 border-b border-gray-300 pb-2 p-4">
                        <h3 className="font-semibold text-sm capitalize">
                          {category.replace(/([A-Z])/g, " $1")}
                        </h3>
                        <button
                          onClick={() => {
                            setSelected((prev) => ({
                              ...prev,
                              [category]: null,
                            }));
                          }}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Clear
                          {selected[category] !== undefined &&
                          selected[category] !== null ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 text-blue-600"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-5.6 7.5V18a1 1 0 01-.45.84l-4 2.5A1 1 0 019 20.5v-8.4L3.2 5.6A1 1 0 013 4z" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-5.6 7.5V18a1 1 0 01-.45.84l-4 2.5A1 1 0 019 20.5v-8.4L3.2 5.6A1 1 0 013 4z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="space-y-2 pl-8 pr-8">
                        {items.map((item, index) => (
                          <div
                            key={index}
                            className={`flex text-sm relative items-center p-3 rounded-sm cursor-pointer transition-all ${
                              selected[category] === index
                                ? "bg-[#6574BD] text-white"
                                : "bg-[#F0F2FC] hover:bg-[#e5e9f9]"
                            } ${item.color || ""}`}
                            onClick={() => handleSelect(category, index)}
                          >
                            <span>{item.label}</span>
                            <span
                              className={`font-semibold absolute -right-2 bg-white border p-1 text-[12px] rounded-sm ${
                                selected[category] === index
                                  ? "border-[#6574BD] text-[#6574BD]"
                                  : "border-[#e5e9f9]"
                              }`}
                            >
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Accordion>
            </div> */}
            <div className="mb-2 relative z-10">
              <div className="flex justify-center">
                <CustomPagination
                  totalItems={entTotalItems}
                  currentPage={entCurrentPage}
                  totalPages={entTotalPages}
                  pageSize={entPageSize}
                  onPageChange={setEntCurrentPage}
                  onPageSizeChange={(newPageSize) => {
                    setEntPageSize(newPageSize);
                    setEntCurrentPage(1); // Reset to first page when changing page size
                  }}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              </div>
            </div>
            {mounted && (
              <AgGridReact
                key={`entitlements-grid-all-${entitlementsSearchQuery}-${entCurrentPage}-${entPageSize}-${filteredEntRowData.length}`}
                rowData={entPaginatedData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                masterDetail={true}
                getRowHeight={(params) => (params?.data?.__isDescRow ? 36 : 40)}
                detailCellRendererParams={detailCellRendererParams}
                detailRowAutoHeight
                domLayout="autoHeight"
                onGridReady={(params) => {
                  gridApiRef.current = params.api;
                }}
                getRowId={(params) => {
                  const data = params.data || {};
                  const baseId =
                    data.entitlementId ||
                    data.entitlementid ||
                    data.id ||
                    `${data.applicationName || ""}-${
                      data.entitlementName || data.name || ""
                    }`;
                  return data.__isDescRow ? `${baseId}-desc` : baseId;
                }}
              />
            )}
            <div className="flex justify-center">
              <CustomPagination
                totalItems={entTotalItems}
                currentPage={entCurrentPage}
                totalPages={entTotalPages}
                pageSize={entPageSize}
                onPageChange={setEntCurrentPage}
                onPageSizeChange={(newPageSize) => {
                  setEntPageSize(newPageSize);
                  setEntCurrentPage(1); // Reset to first page when changing page size
                }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            </div>
          </div>
        );
      },
    },
    {
      label: "Under Review",
      icon: ChevronDown,
      iconOff: ChevronUp,
      component: () => (
        <div className="ag-theme-alpine" style={{ width: "100%" }}>
          <div className="relative mb-4"></div>
          {/* <div className="relative mb-2">
            <Accordion
              iconClass="top-1 right-0 rounded-full text-white bg-purple-800"
              open={true}
            >
              <div className="grid grid-cols-4 gap-10">
                {Object.entries(data).map(([category, items]) => (
                  <div key={category}>
                    <div className="flex justify-between items-center mb-2 border-b border-gray-300 pb-2 p-4">
                      <h3 className="font-semibold text-sm capitalize">
                        {category.replace(/([A-Z])/g, " $1")}
                      </h3>
                      <button
                        onClick={() => {
                          setSelected((prev) => ({
                            ...prev,
                            [category]: null,
                          }));
                        }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Clear
                        {selected[category] !== undefined &&
                        selected[category] !== null ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-blue-600"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-5.6 7.5V18a1 1 0 01-.45.84l-4 2.5A1 1 0 019 20.5v-8.4L3.2 5.6A1 1 0 013 4z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-5.6 7.5V18a1 1 0 01-.45.84l-4 2.5A1 1 0 019 20.5v-8.4L3.2 5.6A1 1 0 013 4z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="space-y-2 pl-8 pr-8">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className={`flex text-sm relative items-center p-3 rounded-sm cursor-pointer transition-all ${
                            selected[category] === index
                              ? "bg-[#6574BD] text-white"
                              : "bg-[#F0F2FC] hover:bg-[#e5e9f9]"
                          } ${item.color || ""}`}
                          onClick={() => handleSelect(category, index)}
                        >
                          <span>{item.label}</span>
                          <span
                            className={`font-semibold absolute -right-2 bg-white border p-1 text-[12px] rounded-sm ${
                              selected[category] === index
                                ? "border-[#6574BD] text-[#6574BD]"
                                : "border-[#e5e9f9]"
                            }`}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Accordion>
          </div> */}
          <div className="mb-2 relative z-10">
            <div className="flex justify-center">
              <CustomPagination
                totalItems={entTotalItems}
                currentPage={entCurrentPage}
                totalPages={entTotalPages}
                pageSize={entPageSize}
                onPageChange={setEntCurrentPage}
                onPageSizeChange={(newPageSize) => {
                  setEntPageSize(newPageSize);
                  setEntCurrentPage(1); // Reset to first page when changing page size
                }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            </div>
          </div>
          {mounted && (
            <AgGridReact
              key={`entitlements-grid-review-${entitlementsSearchQuery}-${entCurrentPage}-${entPageSize}-${filteredEntRowData.length}`}
              rowData={entPaginatedData}
              columnDefs={underReviewColDefs}
              defaultColDef={defaultColDef}
              masterDetail={true}
              getRowHeight={(params) => (params?.data?.__isDescRow ? 36 : 40)}
              detailCellRendererParams={detailCellRendererParams}
              detailRowAutoHeight
              domLayout="autoHeight"
              getRowId={(params) => {
                const data = params.data || {};
                const baseId =
                  data.entitlementId ||
                  data.entitlementid ||
                  data.id ||
                  `${data.applicationName || ""}-${
                    data.entitlementName || data.name || ""
                  }`;
                return data.__isDescRow ? `${baseId}-desc` : baseId;
              }}
            />
          )}
          <div className="flex justify-center">
            <CustomPagination
              totalItems={entTotalItems}
              currentPage={entCurrentPage}
              totalPages={entTotalPages}
              pageSize={entPageSize}
              onPageChange={setEntCurrentPage}
              onPageSizeChange={(newPageSize) => {
                setEntPageSize(newPageSize);
                setEntCurrentPage(1); // Reset to first page when changing page size
              }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
      ),
    },
  ], [
    mounted,
    entPaginatedData,
    entTotalItems,
    entCurrentPage,
    entTotalPages,
    entPageSize,
    entTabIndex,
    entitlementsSearchQuery,
    filteredEntRowData.length,
    gridApiRef,
    colDefs,
    defaultColDef,
    detailCellRendererParams,
    underReviewColDefs,
    setEntCurrentPage,
    setEntPageSize,
    setEntTabIndex,
  ]);

  // Memoize the Entitlements tab component to prevent flickering
  const EntitlementsTabComponent = useCallback(() => {
    return (
      <div
        className="ag-theme-alpine"
        style={{ width: "100%" }}
      >
        <div className="relative mb-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-blue-950 shrink-0">
              Entitlements
            </h1>
            <div className="flex items-center gap-4 flex-1 justify-end min-w-0">
              <div className="relative max-w-md w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={entitlementsSearchInputRef}
                  type="text"
                  placeholder="Search by entitlement name..."
                  value={entitlementsSearchQuery}
                  onChange={(e) => setEntitlementsSearchQuery(e.target.value)}
                  onFocus={() => setIsEntitlementsSearchFocused(true)}
                  onBlur={() => setIsEntitlementsSearchFocused(false)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              {entitlementsSearchQuery.trim() !== "" && (
                <p className="text-sm text-gray-600 whitespace-nowrap shrink-0">
                  Showing {filteredEntRowData.length} of {entRowData.length}{" "}
                  entitlements
                </p>
              )}
              <Exports gridApi={gridApiRef.current} />
            </div>
          </div>
        </div>
        {/* Always render the All tab content without showing inner tabs */}
        {tabsDataEnt[0]?.component && (
          <div>{tabsDataEnt[0].component()}</div>
        )}
      </div>
    );
  }, [
    tabsDataEnt,
    entTabIndex,
    setEntTabIndex,
    entitlementsSearchQuery,
    filteredEntRowData.length,
    entRowData.length,
  ]);

  // Accounts Tab Component - Proper React component that reacts to state changes
  const AccountsTabComponent = useMemo(() => {
    // Create a proper React component
    const Component = () => {
      // Recalculate pagination values inside the component so they update when filteredAccountsRowData changes
      const totalItems = filteredAccountsRowData.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredAccountsRowData.slice(startIndex, endIndex);

      // Grid will update automatically via rowData prop and key

    return (
      <div
        className="ag-theme-alpine"
        style={{
          width: "100%",
          height: accountsTabIndex === 1 ? "auto" : 500,
        }}
      >
        <div className="relative mb-2">
          <div className="flex items-center justify-between border-b border-gray-300 pb-2">
            <h1 className="text-2xl font-bold text-blue-950">
              Accounts
            </h1>
            <button
              onClick={() => openSidebar(null)}
              className="flex items-center space-x-2 px-3 py-2 bg-[#27B973] text-white rounded-md hover:bg-[#22a667] transition-all duration-200 text-sm font-medium"
              title="AI Assist Analysis"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>AI Assist</span>
            </button>
          </div>
          <Accordion
            iconClass="top-1 right-0 rounded-full text-white bg-purple-800"
            open={true}
          >
            <div className="p-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium text-gray-800">
                  Filters
                </h3>
              </div>
              <div className="space-y-3">
                {/* First row - Account Summary (4 items) */}
                <div className="flex">
                  {dataAccount.accountSummary.map((item, index) => (
                    <div
                      key={`accountSummary-${index}`}
                      className={`flex items-center justify-between py-2 px-3 rounded cursor-pointer transition-colors bg-white border border-gray-200 w-1/4 ${
                        selected.accountSummary === index
                          ? "bg-blue-100 border-blue-300"
                          : "bg-gray-100"
                      } ${item.color || ""}`}
                      onClick={() => handleSelect("accountSummary", index)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border-2"
                          style={{
                            borderColor: "#6EC6FF",
                            backgroundColor:
                              selected.accountSummary === index
                                ? "#6EC6FF"
                                : "transparent",
                          }}
                        ></div>
                        <span
                          className={`text-sm ${
                            selected.accountSummary === index
                              ? "text-blue-900"
                              : "text-gray-700"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          selected.accountSummary === index
                            ? "text-blue-700 border-blue-300"
                            : "text-gray-900 border-gray-300"
                        } bg-white border px-2 py-1 rounded text-xs min-w-[20px] text-center`}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Second row - Account Activity (3 items) */}
                <div className="flex">
                  {dataAccount.accountActivity.map((item, index) => (
                    <div
                      key={`accountActivity-${index}`}
                      className={`flex items-center justify-between py-2 px-3 rounded cursor-pointer transition-colors bg-white border border-gray-200 w-1/4 ${
                        selected.accountActivity === index
                          ? "bg-blue-100 border-blue-300"
                          : "bg-gray-100"
                      } ${item.color || ""}`}
                      onClick={() => handleSelect("accountActivity", index)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border-2"
                          style={{
                            borderColor: "#6EC6FF",
                            backgroundColor:
                              selected.accountActivity === index
                                ? "#6EC6FF"
                                : "transparent",
                          }}
                        ></div>
                        <span
                          className={`text-sm ${
                            selected.accountActivity === index
                              ? "text-blue-900"
                              : "text-gray-700"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          selected.accountActivity === index
                            ? "text-blue-700 border-blue-300"
                            : "text-gray-900 border-gray-300"
                        } bg-white border px-2 py-1 rounded text-xs min-w-[20px] text-center`}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Accordion>
        </div>
        
        <div className="mb-2 relative z-10 pt-4">
          <div className="flex items-center justify-between mb-2">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAccountsTabIndex(0)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                  accountsTabIndex === 0
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setAccountsTabIndex(1)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                  accountsTabIndex === 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Service Accounts
              </button>
            </div>
            <div className="flex items-center gap-4 flex-1 justify-end">
              {/* Search Bar */}
              <div className="relative max-w-md w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={accountsTabIndex === 0 ? accountsSearchInputRef : serviceAccountsSearchInputRef}
                  key={`accounts-search-input-${accountsTabIndex}`}
                  type="text"
                  placeholder={accountsTabIndex === 0 ? "Search by Account, Identity, Entitlement..." : "Search by Account, Entitlement, Custodian..."}
                  value={accountsTabIndex === 0 ? accountsSearchQuery : serviceAccountsSearchQuery}
                  onChange={(e) => {
                    if (accountsTabIndex === 0) {
                      setAccountsSearchQuery(e.target.value);
                    } else {
                      setServiceAccountsSearchQuery(e.target.value);
                    }
                  }}
                  onFocus={() => setIsSearchInputFocused(true)}
                  onBlur={() => setIsSearchInputFocused(false)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              {((accountsTabIndex === 0 && accountsSearchQuery) || (accountsTabIndex === 1 && serviceAccountsSearchQuery)) && (
                <p className="text-sm text-gray-600">
                  Showing {accountsTabIndex === 0 ? filteredAccountsRowData.length : filteredServiceAccountsRowData.length} of {accountsTabIndex === 0 ? accountsRowData.length : serviceAccountsRowData.length} accounts
                </p>
              )}
              <Exports gridApi={accountsTabIndex === 0 ? gridApiRef.current : serviceAccountsGridApiRef.current} />
            </div>
          </div>
          <div className="flex justify-center">
            <CustomPagination
              totalItems={accountsTabIndex === 0 ? totalItems : filteredServiceAccountsRowData.length}
              currentPage={currentPage}
              totalPages={accountsTabIndex === 0 ? totalPages : Math.ceil(filteredServiceAccountsRowData.length / pageSize)}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={(newPageSize) => {
                setPageSize(newPageSize);
                setCurrentPage(1); // Reset to first page when changing page size
                closeSidebar();
              }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
        {mounted && accountsTabIndex === 0 && (
          <AgGridReact
            key={`accounts-grid-${filteredAccountsRowData.length}-${currentPage}-${pageSize}`}
            rowData={paginatedData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            masterDetail={true}
            onGridReady={(params: any) => {
              gridApiRef.current = params.api;
            }}
            // detailCellRendererParams={detailCellRendererParams}
          />
        )}
        {mounted && accountsTabIndex === 1 && (
          <div style={{ width: "100%" }}>
            <AgGridReact
              key={`service-accounts-grid-${filteredServiceAccountsRowData.length}-${currentPage}-${pageSize}`}
              rowData={filteredServiceAccountsRowData.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
              columnDefs={serviceAccountsColumnDefs}
              defaultColDef={defaultColDef}
              masterDetail={true}
              detailCellRendererParams={serviceAccountsDetailCellRendererParams}
              detailRowAutoHeight
              domLayout="autoHeight"
              onGridReady={(params: any) => {
                serviceAccountsGridApiRef.current = params.api;
              }}
            />
          </div>
        )}
        <div className="flex justify-center">
          <CustomPagination
            totalItems={accountsTabIndex === 0 ? totalItems : filteredServiceAccountsRowData.length}
            currentPage={currentPage}
            totalPages={accountsTabIndex === 0 ? totalPages : Math.ceil(filteredServiceAccountsRowData.length / pageSize)}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={(newPageSize) => {
              setPageSize(newPageSize);
              setCurrentPage(1); // Reset to first page when changing page size
              closeSidebar();
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>
    );
    };
    return Component;
  }, [
    filteredAccountsRowData,
    accountsRowData,
    filteredServiceAccountsRowData,
    serviceAccountsRowData,
    accountsTabIndex,
    currentPage,
    pageSize,
    columnDefs,
    serviceAccountsColumnDefs,
    serviceAccountsDetailCellRendererParams,
    mounted,
    selected,
    handlePageChange,
    handleSelect,
    gridApiRef,
    serviceAccountsGridApiRef,
    openSidebar,
    closeSidebar,
    accountsSearchQuery,
    serviceAccountsSearchQuery,
    accountsSearchInputRef,
    serviceAccountsSearchInputRef,
    isSearchInputFocused,
    setAccountsTabIndex,
    setAccountsSearchQuery,
    setServiceAccountsSearchQuery,
  ]);

  const tabsData = useMemo(() => [
    {
      label: "About",
      icon: ChevronDown,
      iconOff: ChevronUp,
      component: () => (
        <div className="p-6 bg-white">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-300">
            Application Metadata
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Application ID</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Application Name</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Application Instance Name</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Application Type</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Status</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Description</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Version</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Vendor</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Category</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Created Date</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Last Modified Date</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Created By</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Modified By</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">SCIM URL</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">OAuth Client ID</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">OAuth Client Secret</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">OAuth Token URL</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">OAuth Authorization URL</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">OAuth Scope</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">API Endpoint</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Authentication Type</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Tenant ID</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Environment</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">Tags</label>
                <div className="text-sm text-gray-900">-</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Accounts",
      icon: ChevronDown,
      iconOff: ChevronUp,
      component: AccountsTabComponent,
    },
    {
      label: "Entitlements",
      icon: ChevronDown,
      iconOff: ChevronUp,
      component: EntitlementsTabComponent,
    },
    {
      label: "Sampling",
      icon: ChevronDown,
      iconOff: ChevronUp,
      component: () => {
        const [selectedApplication, setSelectedApplication] =
          useState<string>("");
        const [userName, setUserName] = useState<string>("");
        const [applications, setApplications] = useState<
          Array<{
            applicationId: string;
            applicationName: string;
            scimurl: string;
            filter: string;
          }>
        >([]);
        const [loading, setLoading] = useState<boolean>(true);
        const [error, setError] = useState<string | null>(null);
        const [searchResults, setSearchResults] = useState<any[]>([]);
        const [searchLoading, setSearchLoading] = useState<boolean>(false);
        const [searchError, setSearchError] = useState<string | null>(null);
        const [responseBody, setResponseBody] = useState<any>(null);
        const [selectedUser, setSelectedUser] = useState<any>(null);

        // Use the same reviewerID as other parts of the application
        const reviewerID = getReviewerId() || "";

        // Fetch applications from API and Keyforge endpoint in parallel
        useEffect(() => {
          const fetchApplications = async () => {
            try {
              setLoading(true);
              setError(null);
              const keyforgeUrl =
                "https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getAllApplications";

              const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
              const headers = accessToken ? new Headers() : null;
              if (headers && accessToken) {
                headers.set('Authorization', `Bearer ${accessToken}`);
              }
              const [ownResp, keyforgeResp] = await Promise.all([
                getAllRegisteredApps(reviewerID),
                accessToken && headers ? fetch(keyforgeUrl, {
                  headers: headers,
                })
                  .then((r) => (r.ok ? r.json() : null))
                  .catch(() => null) : Promise.resolve(null),
              ]);

              const ownItems =
                ownResp && ownResp.executionStatus === "success"
                  ? (ownResp.items as Array<{
                      applicationId: string;
                      applicationName: string;
                      scimurl: string;
                      filter: string;
                    }>)
                  : [];

              const keyforgeItems: Array<{
                applicationId: string;
                applicationName: string;
                scimurl: string;
                filter: string;
              }> = keyforgeResp?.Applications
                ? keyforgeResp.Applications.map((a: any) => ({
                    applicationId: a.ApplicationID,
                    applicationName: a.ApplicationName,
                    scimurl: a.SCIMURL,
                    filter: "",
                  }))
                : [];

              // Merge by applicationId or name to avoid duplicates
              const mergedMap = new Map<
                string,
                {
                  applicationId: string;
                  applicationName: string;
                  scimurl: string;
                  filter: string;
                }
              >();

              for (const item of [...ownItems, ...keyforgeItems]) {
                const key = item.applicationId || item.applicationName;
                if (!mergedMap.has(key)) mergedMap.set(key, item);
              }

              const merged = Array.from(mergedMap.values());

              if (merged.length > 0) {
                setApplications(merged);

                // Default to the current application (the one whose detail page we're on)
                if (!selectedApplication) {
                  let defaultApp =
                    merged.find((app) => app.applicationId === id) || null;

                  // Fallback: try matching by application name from localStorage
                  if (!defaultApp) {
                    try {
                      const stored = localStorage.getItem("applicationDetails");
                      if (stored) {
                        const parsed = JSON.parse(stored);
                        const storedName = parsed?.applicationName;
                        if (storedName) {
                          defaultApp = merged.find(
                            (app) => app.applicationName === storedName
                          ) as (typeof merged)[number] | null;
                        }
                      }
                    } catch {
                      // ignore localStorage/JSON errors
                    }
                  }

                  // Fallback: if there's only one app, use it
                  if (!defaultApp && merged.length === 1) {
                    defaultApp = merged[0];
                  }

                  if (defaultApp) {
                    setSelectedApplication(defaultApp.applicationName);
                  }
                }
              } else {
                setError("Failed to fetch applications");
              }
            } catch (err) {
              console.error("Error fetching applications:", err);
              setError("Error loading applications. Please try again.");
            } finally {
              setLoading(false);
            }
          };

          fetchApplications();
        }, [reviewerID, selectedApplication]);

        const handleGetResult = async () => {
          if (selectedApplication && userName) {
            const selectedApp = applications.find(
              (app) => app.applicationName === selectedApplication
            );

            if (!selectedApp) {
              setSearchError("Selected application not found");
              return;
            }

            try {
              setSearchLoading(true);
              setSearchError(null);
              setSearchResults([]);
              setResponseBody(null);
              setSelectedUser(null);

              // Create the payload as per your specification
              const payload = {
                filter: `userName co "${userName}"`,
                applicationId: selectedApp.applicationId,
                scimurl: selectedApp.scimurl,
                applicationName: selectedApp.applicationName,
              };

              console.log("Searching with payload:", payload);

              const response = await searchUsers(payload);

              console.log("Search results:", response);
              setSearchResults(response.items || response || []);
              setResponseBody(response);
              // Set first user as selected by default
              if (response.Resources && response.Resources.length > 0) {
                setSelectedUser(response.Resources[0]);
              }
            } catch (err) {
              console.error("Error searching users:", err);
              setSearchError("Error searching users. Please try again.");
            } finally {
              setSearchLoading(false);
            }
          }
        };

        return (
          <div className="sampling-tab-content relative">
            <div className="absolute top-0 right-0 z-10 print:hidden p-0 m-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center pr-8 m-0 border-0 bg-transparent text-gray-600 shadow-none hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
                title="Print page"
                aria-label="Print page"
              >
                <Printer className="h-5 w-5" />
              </button>
            </div>
            <div
              className="search-container"
              style={{
                display: "flex",
                gap: "15px",
                margin: "40px auto",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* User Name Input */}
              <input
                type="text"
                placeholder="Enter User Name"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  // Clear response data when user name changes
                  setSearchResults([]);
                  setResponseBody(null);
                  setSearchError(null);
                  setSelectedUser(null);
                }}
                style={{
                  padding: "8px 12px",
                  width: "260px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  backgroundColor: "white",
                  color: "#000",
                }}
              />

              {/* Get Result Button */}
              <button
                onClick={handleGetResult}
                disabled={!userName || searchLoading}
                style={{
                  padding: "8px 20px",
                  backgroundColor:
                    userName && !searchLoading ? "#007bff" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor:
                    userName && !searchLoading ? "pointer" : "not-allowed",
                  fontSize: "14px",
                  fontWeight: "500",
                  minWidth: "110px",
                }}
              >
                {searchLoading ? "Searching..." : "Get Result"}
              </button>
            </div>

            {/* Search Results */}
            {(searchResults.length > 0 || searchError) && (
              <div style={{ margin: "20px", width: "100%" }}>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    marginBottom: "10px",
                    color: "#333",
                  }}
                >
                  Search Results
                </h3>

                {searchError && (
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#fee",
                      border: "1px solid #fcc",
                      borderRadius: "4px",
                      color: "#c33",
                      marginBottom: "10px",
                    }}
                  >
                    {searchError}
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      maxHeight: "400px",
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px",
                        backgroundColor: "#f8f9fa",
                        borderBottom: "1px solid #ddd",
                        fontWeight: "600",
                        fontSize: "14px",
                      }}
                    >
                      Found {searchResults.length} result(s)
                    </div>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "10px",
                          borderBottom:
                            index < searchResults.length - 1
                              ? "1px solid #eee"
                              : "none",
                          fontSize: "14px",
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontFamily: "monospace",
                            fontSize: "12px",
                            backgroundColor: "#f8f9fa",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Response Body Display with Sidebar */}
            {responseBody && responseBody.Resources && (
              <div style={{ margin: "20px", width: "100%", padding: "0 20px" }}>
                <div style={{ display: "flex", gap: "20px", height: "500px" }}>
                  {/* Part 1: Left Sidebar - User List */}
                  <div
                    style={{
                      width: "200px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      backgroundColor: "#f8f9fa",
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px",
                        backgroundColor: "#e9ecef",
                        borderBottom: "1px solid #ddd",
                        fontWeight: "600",
                        fontSize: "14px",
                      }}
                    >
                      Users ({responseBody.Resources.length})
                    </div>
                    {responseBody.Resources.map((user: any, index: number) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        style={{
                          padding: "12px",
                          cursor: "pointer",
                          borderBottom:
                            index < responseBody.Resources.length - 1
                              ? "1px solid #eee"
                              : "none",
                          backgroundColor:
                            selectedUser?.id === user.id
                              ? "#007bff"
                              : "transparent",
                          color:
                            selectedUser?.id === user.id ? "white" : "#333",
                          fontSize: "14px",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedUser?.id !== user.id) {
                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedUser?.id !== user.id) {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }
                        }}
                      >
                        <div style={{ fontWeight: "500" }}>{user.userName}</div>
                      </div>
                    ))}
                  </div>

                  {/* Part 2: Middle Panel - User Profile Card */}
                  <div
                    style={{
                      width: "500px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      backgroundColor: "#f8f9fa",
                      overflowY: "auto",
                    }}
                  >
                    {selectedUser ? (
                      <div>
                        {/* User Profile Card */}
                        <div
                          style={{
                            padding: "20px",
                            backgroundColor: "white",
                            height: "100%",
                          }}
                        >
                          {/* Header with Avatar and Name */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              marginBottom: "20px",
                            }}
                          >
                            <div
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                backgroundColor: "#007bff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: "bold",
                                fontSize: "18px",
                                marginRight: "15px",
                              }}
                            >
                              {selectedUser.displayName
                                ? selectedUser.displayName
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .toUpperCase()
                                : selectedUser.userName
                                ? selectedUser.userName
                                    .substring(0, 2)
                                    .toUpperCase()
                                : "U"}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "20px",
                                  fontWeight: "bold",
                                  color: "#333",
                                }}
                              >
                                <UserDisplayName
                                  displayName={selectedUser.displayName || selectedUser.userName}
                                  userType={selectedUser.userType}
                                  employeetype={selectedUser.employeetype}
                                  tags={selectedUser.tags}
                                />
                              </div>
                              {selectedUser.title && (
                                <div
                                  style={{
                                    fontSize: "14px",
                                    color: "#666",
                                    marginTop: "2px",
                                  }}
                                >
                                  {selectedUser.title}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* User Attributes Table */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 2fr",
                              gap: "12px",
                              fontSize: "14px",
                            }}
                          >
                            <div style={{ fontWeight: "600", color: "#333" }}>
                              Username (for login):
                            </div>
                            <div style={{ color: "#666" }}>
                              {selectedUser.userName || "N/A"}
                            </div>

                            <div style={{ fontWeight: "600", color: "#333" }}>
                              Work Email:
                            </div>
                            <div style={{ color: "#666" }}>
                              {selectedUser.emails &&
                              selectedUser.emails.length > 0
                                ? selectedUser.emails[0].value
                                : "N/A"}
                            </div>

                            <div style={{ fontWeight: "600", color: "#333" }}>
                              First Name:
                            </div>
                            <div style={{ color: "#666" }}>
                              {selectedUser.name?.givenName || "N/A"}
                            </div>

                            <div style={{ fontWeight: "600", color: "#333" }}>
                              Last Name:
                            </div>
                            <div style={{ color: "#666" }}>
                              {selectedUser.name?.familyName || "N/A"}
                            </div>

                            <div style={{ fontWeight: "600", color: "#333" }}>
                              Account Status:
                            </div>
                            <div
                              style={{ color: "#28a745", fontWeight: "500" }}
                            >
                              Active
                            </div>

                            <div style={{ fontWeight: "600", color: "#333" }}>
                              Permissions:
                            </div>
                            <div style={{ color: "#6c757d" }}>
                              {selectedUser.groups &&
                              selectedUser.groups.length > 0
                                ? selectedUser.groups.map(
                                    (group: any, index: number) => (
                                      <div
                                        key={index}
                                        style={{ marginBottom: "4px" }}
                                      >
                                        {group.display || group.value}
                                      </div>
                                    )
                                  )
                                : "No group permissions assigned"}
                            </div>

                            {selectedUser.preferredLanguage && (
                              <>
                                <div
                                  style={{ fontWeight: "600", color: "#333" }}
                                >
                                  Preferred Language:
                                </div>
                                <div style={{ color: "#666" }}>
                                  {selectedUser.preferredLanguage}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          color: "#666",
                          fontSize: "14px",
                        }}
                      >
                        Select a user from the list to view details
                      </div>
                    )}
                  </div>

                  {/* Part 3: Right Panel - JSON Data */}
                  <div
                    style={{
                      flex: 1,
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      backgroundColor: "#000000",
                      overflowY: "auto",
                    }}
                  >
                    {selectedUser ? (
                      <div style={{ padding: "15px" }}>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontFamily: "monospace",
                            fontSize: "12px",
                            backgroundColor: "#1a1a1a",
                            padding: "10px",
                            borderRadius: "4px",
                            border: "1px solid #333",
                            color: "#ffffff",
                            height: "calc(100% - 30px)",
                            overflowY: "auto",
                          }}
                        >
                          {JSON.stringify(selectedUser, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          color: "#ffffff",
                          fontSize: "14px",
                        }}
                      >
                        Select a user from the list to view JSON data
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
  ], [
    EntitlementsTabComponent,
    AccountsTabComponent,
  ]);

  return (
    <div>
      <HorizontalTabs
        tabs={tabsData}
        activeClass="bg-[#15274E] text-white rounded-sm -ml-1"
        buttonClass="h-10 -mt-1 w-50"
        className="ml-0.5 border border-gray-300 w-80 h-8 rounded-md"
        activeIndex={tabIndex}
        onChange={setTabIndex}
      />

      {/* Global Right Sidebar used via openSidebar */}

      {/* Comment Modal */}
      {isCommentModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-3"
            data-right-sidebar-keep
          >
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm w-full mx-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Comment</h3>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quick comments
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) setCommentText(val);
                  }}
                >
                  <option value="" disabled>
                    Select a suggestion...
                  </option>
                  <option>Approved - access required for role</option>
                  <option>Rejected - insufficient justification</option>
                  <option>Approve temporarily, revisit next review</option>
                  <option>Duplicate access detected - revoke</option>
                  <option>Compliant per policy and controls</option>
                </select>
              </div>

              <div className="mb-6">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your comment here..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end items-center gap-3">
                <button
                  onClick={handleCancelComment}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors min-w-[80px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveComment}
                  disabled={!commentText.trim()}
                  className={`px-6 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors min-w-[80px] ${
                    commentText.trim()
                      ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
