"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Info,
  X,
  GripVertical,
  Eye,
  EyeOff,
  Database,
  FileSpreadsheet,
  Server,
  Cloud,
  Key,
  Globe,
  Layers,
  Unplug,
  FolderTree,
  Users,
  Tag,
  FileText,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ToggleSwitch from "@/components/ToggleSwitch";
import {
  getAllSupportedApplicationTypesViaProxy,
  executeQuery,
  buildApplicationInstanceConfiguration,
  executeAddNewAppFunction,
  executeUpdateApplicationInstanceConfiguration,
  getInProgressApplications,
  getItAssetApp,
  getFlatfileAppMetadataUsers,
  getAppMetadataUsers,
  uploadAndGetSchemaUsers,
  uploadAndGetSchemaForField,
  saveBaseMetadataUsers,
  saveBaseMetadataForField,
  saveAppDetails,
  onboardApp,
  registerScimAppNewApp,
  getMappedSchema,
  mapSchemaFields,
  extractApplicationIdFromRegisterNewAppResponse,
  persistAppInventoryTokenFromRegisterNewAppResponse,
  attributeMappingsFromGetMappedSchemaJson,
  parseSupportedObjectsApplicationTypeItem,
  describeAdvancedSettingSlotValue,
  coerceSupportedObjectsFieldKey,
  formatIntegrationFieldLabel,
  normalizeSupportedObjectsFieldArray,
  CONNECTION_PARAMETERS_GROUP_ID,
  isGroupedOnboardApplicationType,
  isAiAgentOnboardApplicationType,
  isAiAgentOnlyOnboardApplicationType,
  collectSupportedObjectsFieldKeys,
  buildGroupedApplicationDetailsForNewApp,
  pickViewGetAllUsersFromStep3,
  pickScreenScrappingBaseUrlFromStep3,
  pickScreenScrappingJsonFromStep3,
  isScreenScrappingIntegrationInputComplete,
  VIEW_GET_ALL_USERS_FIELD,
  SCREEN_SCRAPPING_BASE_URL_FIELD,
  SCREEN_SCRAPPING_JSON_FILE_FIELD,
  SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD,
  filterIntegrationFieldsForApplicationType,
  isAdvancedIntegrationGroupId,
  testDatabaseConnection,
  buildDatabaseTestConnectionPayload,
  isDatabaseTestConnectionPayloadComplete,
  fetchDatabaseSchema,
  fetchDatabaseSuggestMapping,
  applyDatabaseSuggestMappingToRows,
  attributeMappingsFromFetchSchemaJson,
  attributeMappingsFromRestUsersSchemaJson,
  buildRestUsersSchemaPayload,
  fetchRestUsersSchema,
  fetchScreenUsersSchema,
  buildScreenUsersSchemaPayload,
  testRestServiceConnection,
  testScreenScrappingConnection,
  isRestLikeGroupedOnboardApplicationType,
  parseConnectionTestResult,
  type SupportedAppTypeAdvancedParts,
  type ApplicationTypeIntegrationFieldGroup,
} from "@/lib/api";
import TabbedIntegrationOnboardGroups from "../components/TabbedIntegrationOnboardGroups";
import AdvancedIntegrationOperationTabs from "../components/AdvancedIntegrationOperationTabs";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";

interface FormData {
  step1: {
    applicationName: string;
    type: string;
    oauthType: string;
    /** When true, Database / RESTService use the AI Agent onboarding wizard. */
    aiAgentOnboard: boolean;
  };
  step2: {
    applicationName: string;
    description: string;
    sourceType: string;
    technicalOwner: string;
    businessOwner: string;
    technicalOwnerEmail: string;
    businessOwnerEmail: string;
  };
  step3: {
    // Dynamic fields based on application type
    [key: string]: any;
  };
  step4: {
    complianceRequirements: string[];
    securityControls: string[];
    monitoringEnabled: boolean;
  };
  step5: {
    backupFrequency: string;
    disasterRecovery: string;
    maintenanceWindow: string;
  };
  step6: {
    reviewNotes: string;
    approvalRequired: boolean;
    goLiveDate: string;
  };
}

/** Lucide icon for application type cards (replaces generic emoji). */
function AppTypeCardIcon({ typeId }: { typeId: string }) {
  const t = typeId.toLowerCase();
  const cn = "w-[1.15rem] h-[1.15rem] text-slate-700";
  const stroke = 1.65;
  if (t.includes("flatfile") || t.includes("flat file") || t.includes("csv")) {
    return <FileSpreadsheet className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("disconnected")) {
    return <Unplug className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("ldap") || t.includes("directory")) {
    return <FolderTree className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("active directory") || t.includes("collector")) {
    return <Users className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("scim")) {
    return <Users className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (
    t.includes("rest") ||
    t.includes("web service") ||
    t.includes("screen") ||
    t.includes("scrap") ||
    (t.includes("api") && !t.includes("jdbc"))
  ) {
    return <Globe className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("jdbc") || t.includes("sql")) {
    return <Database className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("as400") || t.includes("as/400") || t.includes("ibm")) {
    return <Server className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("azure") || t.includes("entra")) {
    return <Cloud className={cn} strokeWidth={stroke} aria-hidden />;
  }
  if (t.includes("okta") || t.includes("oauth") || t.includes("saml") || t.includes("openid")) {
    return <Key className={cn} strokeWidth={stroke} aria-hidden />;
  }
  return <Layers className={cn} strokeWidth={stroke} aria-hidden />;
}

/** Up to 2 initials from a resolved owner's display name, for the small avatar chip. */
function ownerInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Backend uses "IBM AS 400"; older aliases kept for compatibility. */
function isAs400ApplicationType(type: string | undefined): boolean {
  if (!type?.trim()) return false;
  const t = type.trim();
  return t === "AS400" || t === "AS/400" || t === "IBM AS 400";
}

/** Build ApplicationDetails payload for registerscimapp newApp from wizard step 3. */
function buildApplicationDetailsFromStep3(step3: Record<string, unknown>): Record<string, string> {
  const ApplicationDetails: Record<string, string> = {};
  const pick = (targetKey: string, ...sourceKeys: string[]) => {
    for (const sk of sourceKeys) {
      const raw = step3[sk];
      if (raw != null && String(raw).trim() !== "") {
        ApplicationDetails[targetKey] = String(raw);
        return;
      }
    }
  };
  pick("hostname", "hostname");
  pick("port", "port");
  pick("username", "username");
  pick("password", "password");
  pick("user_searchBase", "user_searchBase", "userSearchBase");
  pick("group_searchBase", "group_searchBase", "groupSearchBase");
  pick("default_group", "default_group", "defaultGroup");

  const ldapCanonical = new Set([
    "hostname",
    "port",
    "username",
    "password",
    "user_searchBase",
    "group_searchBase",
    "default_group",
  ]);
  Object.entries(step3).forEach(([k, v]) => {
    if (v == null || typeof v === "object") return;
    const strVal = String(v).trim();
    if (!strVal) return;
    const outKey =
      k === "userSearchBase"
        ? "user_searchBase"
        : k === "groupSearchBase"
          ? "group_searchBase"
          : k === "defaultGroup"
            ? "default_group"
            : k;
    if (!ldapCanonical.has(outKey) && ApplicationDetails[outKey] === undefined) {
      ApplicationDetails[outKey] = strVal;
    }
  });
  return ApplicationDetails;
}

/** ApplicationDetails for newApp — grouped types send supported-objects fields only. */
function buildApplicationDetailsForNewApp(
  step3: Record<string, unknown>,
  appType: string,
  supportedFieldKeys: string[]
): Record<string, string> {
  if (isGroupedOnboardApplicationType(appType)) {
    return buildGroupedApplicationDetailsForNewApp(step3, supportedFieldKeys, appType);
  }
  return buildApplicationDetailsFromStep3(step3);
}

const steps = [
  { id: 1, title: "Select System", description: "" },
  { id: 2, title: "Add Details", description: "" },
  { id: 3, title: "Integration Setting", description: "" },
  { id: 4, title: "File Upload", description: "" },
  { id: 5, title: "Schema Mapping", description: "" },
  { id: 6, title: "Finish Up", description: "" },
];

/** Database / RESTService wizard (AI Agent route). */
const aiAgentWizardSteps = [
  { id: 1, title: "Select System", description: "" },
  { id: 2, title: "Add Details", description: "" },
  { id: 3, title: "Integration Setting", description: "" },
  { id: 4, title: "Schema Mapping", description: "" },
  { id: 5, title: "Finish Up", description: "" },
];

const APPLICATION_SOURCE_TYPE_OPTIONS = [
  "Trusted Source",
  "Target Source",
  "LMS",
] as const;

/** Active Directory Powershell Connector: Agent Pool choices, grouped by region. */
const AD_POWERSHELL_AGENT_POOL_OPTIONS: Array<{
  groupLabel: string | null;
  value: string;
  label: string;
}> = [
  { groupLabel: null, value: "__direct__", label: "No agent — direct or VPN connectivity" },
  { groupLabel: "Middle East & Africa", value: "dpw-uae-jebelali", label: "Jebel Ali · 2 agents, healthy" },
  { groupLabel: "Middle East & Africa", value: "dpw-uae-hq", label: "Dubai HQ · 2 agents, healthy" },
  { groupLabel: "Middle East & Africa", value: "dpw-sn-dakar", label: "Dakar · 1 agent, healthy" },
  { groupLabel: "Europe", value: "dpw-uk-southampton", label: "Southampton · 2 agents, healthy" },
  { groupLabel: "Europe", value: "dpw-nl-rotterdam", label: "Rotterdam · 2 agents, healthy" },
  { groupLabel: "Asia Pacific", value: "dpw-in-mundra", label: "Mundra · 2 agents, healthy" },
  { groupLabel: "Asia Pacific", value: "dpw-au-sydney", label: "Sydney · 1 agent, degraded" },
  { groupLabel: "Americas", value: "dpw-ca-princerupert", label: "Prince Rupert · 2 agents, healthy" },
  { groupLabel: "Americas", value: "dpw-pe-callao", label: "Callao · 2 agents, healthy" },
];

export default function AddApplicationPage() {
  const router = useRouter();
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const searchParams = useSearchParams();
  const completeIntegrationRaw = searchParams.get("completeIntegration")?.trim().toLowerCase() ?? "";
  const isCompleteIntegration =
    completeIntegrationRaw === "1" || completeIntegrationRaw === "true" || completeIntegrationRaw === "yes";
  const [currentStep, setCurrentStep] = useState(1);

  const appIdFromUrl = searchParams.get("appId") ?? "";
  const appNameFromUrl = searchParams.get("appName") ?? "";
  const appTypeFromUrl = searchParams.get("appType") ?? "";

  // Attribute mapping state (declared early so getallapp effect can call setAttributeMappingData)
  type DatabaseMappingSourceSelection = "bestMatch" | "option2" | "custom";
  type AttributeMapping = {
    id: string;
    source: string;
    target: string;
    defaultValue?: string;
    type: string;
    keyfieldMapping?: boolean;
    bestMatch?: string;
    option2?: string;
    /** Which of the 3 selectable columns is active for this row. */
    sourceSelection?: DatabaseMappingSourceSelection;
  };
  const [attributeMappingData, setAttributeMappingData] = useState<AttributeMapping[]>([]);

  // Flatfile step 3: file input element and selected file
  const flatfileFileInputRef = useRef<HTMLInputElement>(null);
  const flatfileFileRef = useRef<File | null>(null);
  const flatfilePerFieldFileInputRef = useRef<HTMLInputElement>(null);
  const flatfileUploadForFieldRef = useRef<string | null>(null);
  const screenScrappingJsonFileInputRef = useRef<HTMLInputElement>(null);
  const [flatfileMetadataUsers, setFlatfileMetadataUsers] = useState<any>(null);
  const [flatfilePreviewPage, setFlatfilePreviewPage] = useState(1);
  const [flatfilePreviewCollapsed, setFlatfilePreviewCollapsed] = useState(false);
  const [flatfilePerFieldPreviewCollapsed, setFlatfilePerFieldPreviewCollapsed] = useState<Record<string, boolean>>({});
  const [flatfilePerFieldExpanded, setFlatfilePerFieldExpanded] = useState<Record<string, boolean>>({});
  const FLATFILE_PREVIEW_PAGE_SIZE = 10;
  // Disconnected app: metadata users loaded on File Upload step
  const [disconnectedMetadataUsers, setDisconnectedMetadataUsers] = useState<any | null>(null);
  const [disconnectedFile, setDisconnectedFile] = useState<File | null>(null);
  const [disconnectedUploadLoading, setDisconnectedUploadLoading] = useState(false);
  const [disconnectedPerFieldExpanded, setDisconnectedPerFieldExpanded] =
    useState<Record<string, boolean>>({});
  const [disconnectedMetadataSaved, setDisconnectedMetadataSaved] = useState(false);
  const [disconnectedPerFieldPreview, setDisconnectedPerFieldPreview] = useState<
    Record<string, any[]>
  >({});
  const [disconnectedPerFieldFile, setDisconnectedPerFieldFile] = useState<
    Record<string, File | null>
  >({});

  // Edit mode: application details from IT Asset getapp (shown in card at top)
  const [appDetails, setAppDetails] = useState<Record<string, unknown> | null>(null);
  const [appDetailsLoading, setAppDetailsLoading] = useState(false);

  const [jdbcReadPasswordVisible, setJdbcReadPasswordVisible] = useState(false);
  const [ibmToolboxPasswordVisible, setIbmToolboxPasswordVisible] = useState(false);
  /** AS400 main cards: expand/collapse independently (not tied to step3.integrationSettings). */
  const [as400ReadOperationsExpanded, setAs400ReadOperationsExpanded] = useState(false);
  const [as400WriteOperationsExpanded, setAs400WriteOperationsExpanded] = useState(false);
  /** Active Directory Domain: Directory & Vault Settings card expand/collapse. */
  const [adDomainVaultSettingsExpanded, setAdDomainVaultSettingsExpanded] = useState(false);
  /** Active Directory Domain: Inherited Global Policies — locked until Edit is clicked. */
  const [inheritedPoliciesEditing, setInheritedPoliciesEditing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [attributeMappingPage, setAttributeMappingPage] = useState(1);
  const [isEditingAttribute, setIsEditingAttribute] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<any>(null);
  const ATTR_MAPPING_PAGE_SIZE = 10;
  const [groupedIntegrationTab, setGroupedIntegrationTab] = useState(CONNECTION_PARAMETERS_GROUP_ID);
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);
  const [testConnectionFeedback, setTestConnectionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [databaseSessionId, setDatabaseSessionId] = useState<string | null>(null);
  const [databaseSchemaLoaded, setDatabaseSchemaLoaded] = useState(false);
  const [fetchSchemaLoading, setFetchSchemaLoading] = useState(false);
  const [fetchSchemaFeedback, setFetchSchemaFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  // SCIM Attributes state
  const [scimAttributes, setScimAttributes] = useState<string[]>([]);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
  // Active Directory Powershell Connector: custom Agent Pool dropdown (native <select> can't be
  // font-sized consistently across browsers, so this is a styled list instead).
  const [isAgentPoolDropdownOpen, setIsAgentPoolDropdownOpen] = useState(false);
  const agentPoolDropdownRef = useRef<HTMLDivElement>(null);
  const [sourceAttributeValue, setSourceAttributeValue] = useState("");
  const [editSourceAttributeValue, setEditSourceAttributeValue] = useState("");
  const [targetAttributeValue, setTargetAttributeValue] = useState("");
  const [defaultAttributeValue, setDefaultAttributeValue] = useState("");
  const [keyfieldChecked, setKeyfieldChecked] = useState(false);
  const [mappingType, setMappingType] = useState<string>("direct");
  const [filteredAttributes, setFilteredAttributes] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const [dbMappingOpenRowId, setDbMappingOpenRowId] = useState<string | null>(null);
  const [dbMappingDropdownRect, setDbMappingDropdownRect] = useState<DOMRect | null>(null);
  const [dbMappingFilter, setDbMappingFilter] = useState("");
  const dbMappingAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dbMappingDropdownPortalRef = useRef<HTMLDivElement | null>(null);
  const scimDropdownSearchRef = useRef("");

  const normalizeScimAttributesList = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[])
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item != null && typeof item === "object") {
          const o = item as Record<string, unknown>;
          return String(o.name ?? o.attribute ?? o.Attribute ?? o.value ?? "").trim();
        }
        return String(item ?? "").trim();
      })
      .filter(Boolean);
  };

  const filterScimAttributeList = (attrs: string[], searchTerm: string): string[] => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return attrs;
    return attrs.filter((attr) => attr.toLowerCase().includes(term));
  };

  // Application types from API (optional advancedSetting → three summary cards on step 1)
  type ApplicationTypeOption = {
    id: string;
    title: string;
    subtitle: string;
    advancedSettingParts?: SupportedAppTypeAdvancedParts | null;
  };
  const [applicationTypes, setApplicationTypes] = useState<ApplicationTypeOption[]>([]);
  const [oauthTypes, setOauthTypes] = useState<string[]>([]);
  const [isLoadingAppTypes, setIsLoadingAppTypes] = useState(false);
  // Field definitions from API
  const [applicationTypeFields, setApplicationTypeFields] = useState<Record<string, string[]>>({});
  /** Grouped fields from nested `advancedSetting` in supported-objects (e.g. Database, RESTService). */
  const [applicationTypeIntegrationGroups, setApplicationTypeIntegrationGroups] = useState<
    Record<string, ApplicationTypeIntegrationFieldGroup[]>
  >({});
  /** Step 3: expand/collapse for each integration `advancedSetting` group (`appType::groupId`). */
  const [integrationGroupExpanded, setIntegrationGroupExpanded] = useState<Record<string, boolean>>({});
  const [oauthTypeFields, setOauthTypeFields] = useState<Record<string, string[]>>({});
  // User search (Add Details step - Technical Owner / Business Owner)
  type OwnerField = "technicalOwner" | "businessOwner";
  type UserSearchHit = {
    id: string;
    name: string;
    email: string;
    username: string;
    department?: string;
    jobTitle?: string;
    employeeId?: string;
  };
  const [userSearchAllUsers, setUserSearchAllUsers] = useState<UserSearchHit[]>([]);
  const [userSearchField, setUserSearchField] = useState<OwnerField | null>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [submitRequestLoading, setSubmitRequestLoading] = useState(false);
  const [submitRequestError, setSubmitRequestError] = useState<string | null>(null);
  const [submitProgressToast, setSubmitProgressToast] = useState<string | null>(null);
  const [onboardLoading, setOnboardLoading] = useState(false);
  /** Application id from POST newApp on final submit (used for getmappedschema if present). */
  const [wizardRegisteredAppId, setWizardRegisteredAppId] = useState<string | null>(null);
  const step2UserFetchedRef = useRef(false);
  const technicalOwnerDropdownRef = useRef<HTMLDivElement>(null);
  const businessOwnerDropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<FormData>({
    step1: {
      applicationName: "",
      type: "",
      oauthType: "",
      aiAgentOnboard: false,
    },
    step2: {
      applicationName: "",
      description: "",
      sourceType: "",
      technicalOwner: "",
      businessOwner: "",
      technicalOwnerEmail: "",
      businessOwnerEmail: "",
    },
    step3: {
      // Dynamic fields will be populated based on application type
    },
    step4: {
      complianceRequirements: [],
      securityControls: [],
      monitoringEnabled: false,
    },
    step5: {
      backupFrequency: "",
      disasterRecovery: "",
      maintenanceWindow: "",
    },
    step6: {
      reviewNotes: "",
      approvalRequired: false,
      goLiveDate: "",
    },
  });

  const isAiAgentWizard =
    formData.step1.aiAgentOnboard && isAiAgentOnboardApplicationType(formData.step1.type);
  const wizardSteps = isAiAgentWizard ? aiAgentWizardSteps : steps;

  // When opening from Settings for a non-integrated app, start at step 3 (Integration Setting)
  useEffect(() => {
    if (isCompleteIntegration) setCurrentStep(3);
  }, [isCompleteIntegration]);

  // Edit mode: fetch application details from IT Asset getapp when we have appId
  useEffect(() => {
    if (!isCompleteIntegration || !appIdFromUrl?.trim() || typeof window === "undefined") return;
    setAppDetailsLoading(true);
    setAppDetails(null);
    getItAssetApp(appIdFromUrl.trim())
      .then((data) => {
        if (data != null && typeof data === "object") {
          setAppDetails(data as Record<string, unknown>);
          const desc = (data as Record<string, unknown>).description ?? (data as Record<string, unknown>).Description;
          if (desc != null && String(desc).trim() !== "") {
            setFormData((prev) => ({ ...prev, step2: { ...prev.step2, description: String(desc).trim() } }));
          }
        } else {
          setAppDetails(null);
        }
      })
      .catch(() => setAppDetails(null))
      .finally(() => setAppDetailsLoading(false));
  }, [isCompleteIntegration, appIdFromUrl]);

  // Prefill from URL params (app name/type from app-inventory row) so step 3 never shows "No Application Selected"
  useEffect(() => {
    if (!isCompleteIntegration || (!appNameFromUrl && !appTypeFromUrl)) return;
    setFormData((prev) => ({
      ...prev,
      step1: {
        ...prev.step1,
        type: appTypeFromUrl || prev.step1.type,
      },
      step2: {
        ...prev.step2,
        applicationName: appNameFromUrl || prev.step2.applicationName,
      },
    }));
  }, [isCompleteIntegration, appNameFromUrl, appTypeFromUrl]);

  // Fresh wizard entry with a type preselected (e.g. from Global AD config management), not resuming an existing app
  useEffect(() => {
    if (isCompleteIntegration || !appTypeFromUrl) return;
    setFormData((prev) => ({
      ...prev,
      step1: { ...prev.step1, type: appTypeFromUrl },
    }));
    setCurrentStep(2);
  }, [isCompleteIntegration, appTypeFromUrl]);

  // Fetch and map application data from getallapp (getInProgressApplications) when in complete-integration mode
  useEffect(() => {
    if (!isCompleteIntegration || !appIdFromUrl || typeof window === "undefined") return;
    getInProgressApplications()
      .then((res: any) => {
        if (!res || typeof res !== "object") return;
        const idKeys = [
          "ApplicationID", "applicationID", "ApplicationId", "applicationId",
          "id", "Id", "appId", "AppId", "appid", "application_id",
        ];
        const getItemId = (item: any): string =>
          String(
            idKeys.reduce((acc: string | null, k) => acc ?? (item?.[k] != null && item[k] !== "" ? String(item[k]).trim() : null), null) ?? ""
          );
        const getItemName = (item: any): string =>
          String(item?.name ?? item?.ApplicationName ?? item?.applicationName ?? item?.Name ?? item?.appName ?? item?.application_name ?? item?.title ?? "").trim();
        // getallapp can return root array or { applications, ... }; category = application type
        const list: any[] = Array.isArray(res)
          ? res
          : (() => {
              const direct = res.applications ?? res.Applications ?? res.apps ?? res.data ?? res.result ?? res.list ?? res.content ?? res.items ?? res.value ?? res.body ?? res.getallapp ?? res.appList;
              if (Array.isArray(direct)) return direct;
              if (direct && typeof direct === "object" && Array.isArray((direct as any).items)) return (direct as any).items;
              if (direct && typeof direct === "object" && Array.isArray((direct as any).data)) return (direct as any).data;
              if (res.data && Array.isArray(res.data)) return res.data;
              if (res.data && res.data.applications && Array.isArray(res.data.applications)) return res.data.applications;
              return [];
            })();
        const appIdNorm = appIdFromUrl.trim().toLowerCase();
        // Find app by id (appid, etc.) or by name when appid is empty; match case-insensitive and trimmed
        const app = list.find((item: any) => {
          const id = getItemId(item).trim().toLowerCase();
          const name = getItemName(item).toLowerCase();
          return id === appIdNorm || name === appIdNorm || (appIdNorm && (id.includes(appIdNorm) || name.includes(appIdNorm)));
        });
        if (!app || typeof app !== "object") return;
        const conn = app.connectionDetails ?? app.ConnectionDetails ?? app.connection ?? {};
        const owner = app.owner ?? app.Owner;
        const ownerValue = typeof owner === "string" ? owner : owner?.value ?? owner?.email ?? "";
        const ownerDisplay = typeof owner === "object" && owner?.value ? owner.value : ownerValue;
        const str = (v: unknown) => (v != null && v !== "" ? String(v) : "");
        const toSnake = (s: string) => s.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
        // Map connectionDetails into step3 with camelCase and snake_case so API-driven and custom fields get values
        const step3FromConn: Record<string, string> = {};
        Object.entries(conn).forEach(([k, v]) => {
          const val = str(v);
          step3FromConn[k] = val;
          const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
          if (camel !== k) step3FromConn[camel] = val;
          const snake = toSnake(k);
          if (snake !== k) step3FromConn[snake] = val;
        });
        setFormData((prev) => {
          const step3Mapped = {
            ...prev.step3,
            ...step3FromConn,
            hostname: str(conn.hostname ?? conn.Hostname ?? prev.step3.hostname),
            port: str(conn.port ?? conn.Port ?? prev.step3.port),
            username: str(conn.username ?? conn.Username ?? prev.step3.username),
            password: str(conn.password ?? conn.Password ?? prev.step3.password),
            userSearchBase: str(conn.userSearchBase ?? conn.user_searchBase ?? conn.UserSearchBase ?? prev.step3.userSearchBase),
            groupSearchBase: str(conn.groupSearchBase ?? conn.group_searchBase ?? conn.GroupSearchBase ?? prev.step3.groupSearchBase),
            user_searchBase: str(conn.userSearchBase ?? conn.user_searchBase ?? conn.UserSearchBase ?? prev.step3.userSearchBase),
            group_searchBase: str(conn.groupSearchBase ?? conn.group_searchBase ?? conn.GroupSearchBase ?? prev.step3.groupSearchBase),
          };
          return {
          ...prev,
          step1: {
            ...prev.step1,
            // category = application type in getallapp response
            type: app.category ?? app.ApplicationType ?? app.applicationType ?? app.type ?? app.Type ?? prev.step1.type,
            oauthType: app.OAuthType ?? app.oauthType ?? prev.step1.oauthType,
          },
          step2: {
            ...prev.step2,
            applicationName: app.ApplicationName ?? app.applicationName ?? app.name ?? app.Name ?? app.appName ?? app.application_name ?? app.title ?? prev.step2.applicationName,
            description: app.description ?? app.Description ?? prev.step2.description,
            technicalOwner: ownerDisplay || prev.step2.technicalOwner,
            technicalOwnerEmail: ownerValue || prev.step2.technicalOwnerEmail,
            businessOwner: prev.step2.businessOwner,
            businessOwnerEmail: prev.step2.businessOwnerEmail,
          },
          step3: step3Mapped,
          };
        });

        // Map only provisioningAttrMap to attributeMappingData (Schema Mapping step); payload may have schemaMappingDetails null
        const schema = app.schemaMappingDetails ?? app.SchemaMappingDetails ?? app.schemaMapping ?? null;
        const provisioning =
          schema && typeof schema === "object"
            ? (schema.provisioningAttrMap ?? schema.ProvisioningAttrMap ?? schema.provisioning_attr_map ?? {})
            : {};
        const getVariable = (val: unknown): string => {
          if (val == null) return "";
          if (typeof val === "string") return val.trim();
          if (typeof val !== "object") return "";
          const o = val as Record<string, unknown>;
          const v = o.variable ?? o.Variable ?? (o.value && typeof o.value === "object" ? (o.value as Record<string, unknown>).variable : null);
          return (v != null && v !== "" ? String(v) : "").trim();
        };
        const mapped: AttributeMapping[] = [];
        let idx = 0;
        if (provisioning && typeof provisioning === "object" && !Array.isArray(provisioning)) {
          Object.entries(provisioning).forEach(([targetAttr, val]) => {
            const variable = getVariable(val);
            if (variable || targetAttr.trim()) mapped.push({ id: `p-${idx++}`, source: variable || "", target: targetAttr.trim(), defaultValue: "", type: "provisioning" });
          });
        }
        if (mapped.length > 0) setAttributeMappingData(mapped);
      })
      .catch((err) => {
        console.error("Error fetching getallapp data for mapping:", err);
      });
  }, [isCompleteIntegration, appIdFromUrl]);

  // When entering File Upload step for Disconnected Application, clear previous metadata users
  useEffect(() => {
    if (currentStep === 4 && formData.step1.type === "Disconnected Application") {
      setDisconnectedMetadataUsers(null);
      setDisconnectedFile(null);
      setDisconnectedMetadataSaved(false);
    }
  }, [currentStep, formData.step1.type]);

  // When entering File Upload step for Disconnected Application, call getappmetadata/<applicationname>/users
  useEffect(() => {
    if (currentStep !== 4 || formData.step1.type !== "Disconnected Application") return;
    const appName = formData.step2.applicationName?.trim();
    if (!appName) return;
    let cancelled = false;
    getAppMetadataUsers(appName)
      .then((data) => {
        if (!cancelled && data) {
          const anyData = data as any;
          const preview =
            (anyData && Array.isArray(anyData.preview) && anyData.preview) ||
            (Array.isArray(anyData) ? anyData : []);

          // If upload schema has not yet been loaded, seed from getappmetadata preview if available
          if (!disconnectedMetadataUsers && Array.isArray(preview)) {
            setDisconnectedMetadataUsers(data);
          }

          // Map parentFieldDefinition + multivaluedFieldDefinition into formData.step3
          const parent = anyData.parentFieldDefinition ?? {};
          const mvDef = Array.isArray(anyData.multivaluedFieldDefinition)
            ? anyData.multivaluedFieldDefinition
            : [];

          setFormData((prev) => {
            const prevStep3 = prev.step3 || {};
            const baseMv = parent.multivaluedField;
            const mvList = Array.isArray(baseMv)
              ? baseMv
              : baseMv
              ? [String(baseMv)]
              : Array.isArray(prevStep3.multivaluedField)
              ? (prevStep3.multivaluedField as string[])
              : prevStep3.multivaluedField
              ? [String(prevStep3.multivaluedField)]
              : [];

            const existingTypes =
              (prevStep3.multivaluedFieldEntitlementType as Record<
                string,
                string
              >) || {};
            const mappedTypes: Record<string, string> = { ...existingTypes };
            mvDef.forEach((entry: any) => {
              const fname = String(entry?.fieldName ?? "").trim();
              const etype = String(entry?.entitlementType ?? "").trim();
              if (fname && etype) mappedTypes[fname] = etype;
            });

            return {
              ...prev,
              step3: {
                ...prevStep3,
                uidAttribute:
                  parent.uidAttribute ??
                  prevStep3.uidAttribute ??
                  "",
                statusField:
                  parent.statusField ?? prevStep3.statusField ?? "",
                dateFormat:
                  parent.dateFormat ?? prevStep3.dateFormat ?? "",
                multivaluedField: mvList,
                fieldDelimiter:
                  anyData.fieldDelimiter ??
                  prevStep3.fieldDelimiter ??
                  ",",
                multivalueDelimiter:
                  anyData.multivalueDelimiter ??
                  prevStep3.multivalueDelimiter ??
                  "#",
                multivaluedFieldEntitlementType: mappedTypes,
              },
            };
          });

          // If metadata already exists, show multivalued entity section
          if (parent && preview && Array.isArray(preview)) {
            setDisconnectedMetadataSaved(true);
          }

          console.debug("getappmetadata/<app>/users response:", data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch app metadata users for disconnected app:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentStep, formData.step1.type, formData.step2.applicationName, disconnectedMetadataUsers]);

  // When we land on step 3 with Flatfile type, call getappmetadata/ACME_FlatfileLoad/users
  useEffect(() => {
    if (currentStep !== 3 || formData.step1.type !== "Flatfile" || typeof window === "undefined") return;
    setFlatfileMetadataUsers(null);
    setFlatfilePreviewPage(1);
    getFlatfileAppMetadataUsers()
      .then((data) => setFlatfileMetadataUsers(data))
      .catch(() => setFlatfileMetadataUsers(null));
  }, [currentStep, formData.step1.type]);

  const handleInputChange = (step: keyof FormData, field: string, value: any) => {
    setFormData(prev => {
      const nextStep = { ...prev[step], [field]: value };
      if (step === "step3") {
        if (field === "userSearchBase") nextStep.user_searchBase = value;
        else if (field === "groupSearchBase") nextStep.group_searchBase = value;
        else if (field === "user_searchBase") nextStep.userSearchBase = value;
        else if (field === "group_searchBase") nextStep.groupSearchBase = value;
      }
      return { ...prev, [step]: nextStep };
    });
  };

  const toggleStep1ApplicationType = (typeId: string, aiAgentOnboard = false) => {
    setFormData((prev) => {
      const isSameSelection =
        prev.step1.type === typeId && prev.step1.aiAgentOnboard === aiAgentOnboard;
      return isSameSelection
        ? { ...prev, step1: { ...prev.step1, type: "", oauthType: "", aiAgentOnboard: false } }
        : { ...prev, step1: { ...prev.step1, type: typeId, aiAgentOnboard } };
    });
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleNext = async () => {
    if (currentStep === 1 && (isLoadingAppTypes || !formData.step1.type?.trim())) return;
    const isDisconnectedApp = formData.step1.type === "Disconnected Application";
    const maxStep = isAiAgentWizard ? 5 : isDisconnectedApp ? 6 : 5;
    if (currentStep >= maxStep) return;
    if (currentStep === 2) {
      if (!formData.step2.sourceType?.trim()) {
        setSubmitRequestError("Please select a source type.");
        return;
      }
      setSubmitRequestError(null);
      setCurrentStep(currentStep + 1);
    } else if (!isCompleteIntegration && currentStep === 3 && isDisconnectedApp) {
      // Integration Settings: Disconnected Application - save app details via saveappdetails
      setSubmitRequestError(null);
      setSubmitRequestLoading(true);
      try {
        const ownerValue = formData.step2.technicalOwnerEmail || formData.step2.businessOwnerEmail || "";
        const step3 = formData.step3 || {};
        // Build connectionDetails exactly as disconnected app expects
        const connectionDetails: Record<string, unknown> = {
          owner: step3.owner ?? "",
          oimAppId: step3.oimAppId ?? "",
          ticketingAppId: step3.ticketingAppId ?? "",
          oimAPIToken: step3.oimAPIToken ?? "",
          ticketingSystem: step3.ticketingSystem ?? "",
          ticketingAPIToken: step3.ticketingAPIToken ?? "",
          isIntegratedWithOIM: step3.isIntegratedWithOIM ?? false,
          manuallyFulfill: step3.manuallyFulfill ?? true,
          assignTo: step3.assignTo ?? "",
          raiseTicket: step3.raiseTicket ?? "",
          applicationName: step3.applicationName ?? "",
        };

        // Build provisioning/reconcilliation maps from Schema Mapping state; if none, apply disconnected defaults
        let provisioningAttrMap: Record<string, { variable: string }> = {};
        let reconcilliationAttrMap: Record<string, { variable: string }> = {};

        attributeMappingData.forEach((mapping) => {
          if (mapping.target?.trim()) {
            provisioningAttrMap[mapping.target.trim()] = { variable: mapping.source?.trim() ?? "" };
          }
        });

        if (Object.keys(provisioningAttrMap).length === 0) {
          provisioningAttrMap = {
            id: { variable: "id" },
            userName: { variable: "userName" },
            userid: { variable: "externalId" },
          };
          reconcilliationAttrMap = {
            externalId: { variable: "userid" },
            id: { variable: "id" },
            userName: { variable: "userName" },
          };
        }

        const today = new Date();
        const dd = String(today.getDate()).padStart(2, "0");
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const yyyy = today.getFullYear();
        const discoveredOn = `${dd}/${mm}/${yyyy}`;

        const savePayload = {
          tenantId: "ACMECOM",
          appid: "",
          serviceURL: "",
          name: formData.step2.applicationName || "",
          description: formData.step2.description || "",
          category: formData.step1.type || "",
          owner: { type: "User", value: ownerValue },
          status: "New",
          connectionDetails,
          dicoveredOn: discoveredOn,
          integratedOn: "",
          schemaMappingDetails: {
            provisioningAttrMap,
            reconcilliationAttrMap,
          },
          // Default empty applicationConfigurationDetails structure expected by disconnected app
          applicationConfigurationDetails: {
            hook: {
              name: "",
              postProcessEvent: [
                {
                  authorization: "",
                  endpoint: "",
                  isEnabled: false,
                  type: "service",
                  priority: -1,
                  operation: "",
                  customHeaders: {},
                },
                {
                  agentId: "",
                  isEnabled: false,
                  implementationClass: "",
                  type: "sdk",
                  priority: -1,
                  operation: "",
                },
              ],
              preProcessEvent: [
                {
                  authorization: "",
                  endpoint: "",
                  isEnabled: false,
                  type: "service",
                  priority: -1,
                  operation: "",
                  customHeaders: {},
                },
                {
                  agentId: "",
                  isEnabled: false,
                  implementationClass: "",
                  type: "sdk",
                  priority: -1,
                  operation: "",
                },
              ],
            },
            threshold: [
              {
                exceptionalCases: {
                  peakDays: [{ endData: "", startDate: "" }],
                  peakTime: [{ startTime: "", endTime: "" }],
                },
                cutOff: {
                  maximumAllowed: -1,
                  stopFurtherOperations: false,
                  sendAlertTo: "",
                  durationInMinutes: 0,
                },
                operation: "Disable",
              },
              {
                exceptionalCases: {
                  peakDays: [{ endData: "", startDate: "" }],
                  peakTime: [{ startTime: "", endTime: "" }],
                },
                cutOff: {
                  maximumAllowed: -1,
                  stopFurtherOperations: false,
                  sendAlertTo: "",
                  durationInMinutes: 0,
                },
                operation: "Create",
              },
              {
                exceptionalCases: {
                  peakDays: [{ endData: "", startDate: "" }],
                  peakTime: [{ startTime: "", endTime: "" }],
                },
                cutOff: {
                  maximumAllowed: -1,
                  stopFurtherOperations: false,
                  sendAlertTo: "",
                  durationInMinutes: 0,
                },
                operation: "Delete",
              },
            ],
            autoRetry: {
              isEnabled: false,
              interval: -1,
              maximumRetry: 0,
            },
          },
          iga: false,
          lcm: false,
          sso: false,
        };
        await saveAppDetails(savePayload);
        setCurrentStep(currentStep + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save application details";
        setSubmitRequestError(message);
      } finally {
        setSubmitRequestLoading(false);
      }
    } else if (isCompleteIntegration && (currentStep === 3 || currentStep === 4)) {
      setSubmitRequestError(null);
      setSubmitRequestLoading(true);
      try {
        const ownerEmail = formData.step2.technicalOwnerEmail || formData.step2.businessOwnerEmail || "";
        const step3 = formData.step3 || {};
        // Build provisioningAttrMap from Schema Mapping step: { [target]: { variable: source } }
        const provisioningAttrMap: Record<string, { variable: string }> = {};
        attributeMappingData.forEach((mapping) => {
          if (mapping.target?.trim()) {
            provisioningAttrMap[mapping.target.trim()] = { variable: mapping.source?.trim() ?? "" };
          }
        });
        const userSearchBaseVal = String(step3.userSearchBase ?? step3.user_searchBase ?? "").trim();
        const groupSearchBaseVal = String(step3.groupSearchBase ?? step3.group_searchBase ?? "").trim();
        const { userSearchBase: _u, groupSearchBase: _g, user_searchBase: _ub, group_searchBase: _gb, ...step3Rest } = step3 as Record<string, unknown>;
        const connectionDetails: Record<string, unknown> = {
          ...step3Rest,
          hostname: step3.hostname ?? "",
          port: step3.port ?? "",
          username: step3.username ?? "",
          password: step3.password ?? "",
          user_searchBase: userSearchBaseVal,
          group_searchBase: groupSearchBaseVal,
        };
        const savePayload = {
          tenantId: "ACMECOM",
          appid: appIdFromUrl || "",
          serviceURL: "",
          name: formData.step2.applicationName || "",
          description: formData.step2.description || "",
          category: formData.step1.type || "",
          owner: { type: "User", value: ownerEmail },
          status: "InProgress",
          connectionDetails,
          dicoveredOn: null,
          integratedOn: null,
          schemaMappingDetails: {
            provisioningAttrMap,
            reconcilliationAttrMap: {},
          },
          applicationConfigurationDetails: null,
          iga: false,
          lcm: false,
          sso: false,
          ...(appIdFromUrl && !Number.isNaN(Number(appIdFromUrl)) ? { key: Number(appIdFromUrl) } : {}),
        };
        await saveAppDetails(savePayload);
        setCurrentStep(currentStep + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save application details";
        setSubmitRequestError(message);
      } finally {
        setSubmitRequestLoading(false);
      }
    } else if (
      isAiAgentWizard &&
      !isCompleteIntegration &&
      currentStep === 3 &&
      isGroupedOnboardApplicationType(formData.step1.type)
    ) {
      if (!isIntegrationStepThreeReady()) {
        setSubmitRequestError(
          isScreenScrappingAiAgent
            ? "Enter baseURL, upload a JSON file, load schema, then continue to Schema Mapping."
            : isRestLikeOnboardType
            ? "Enter Get All Users, load schema, then continue to Schema Mapping."
            : "Test the connection, enter Get All Users, load schema, then continue to Schema Mapping."
        );
        return;
      }
      setSubmitRequestError(null);
      setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (submitRequestLoading) return;
    setSubmitRequestError(null);
    if (isCompleteIntegration && currentStep === 3) {
      router.push("/settings/app-inventory");
      return;
    }
    if (currentStep === 1) {
      if (isAiAgentWizard) {
        router.push("/settings/app-inventory");
      }
      return;
    }
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (submitRequestLoading) return;
    setSubmitRequestError(null);
    setSubmitRequestLoading(true);

    try {
      const appType = formData.step1.type?.trim() || "";
      const isDisconnectedApp = appType === "Disconnected Application";
      const isFlatfile = appType === "Flatfile";
      const usesNewAppRegistration =
        !isCompleteIntegration && !isDisconnectedApp && !isFlatfile;

      if (usesNewAppRegistration) {
        const step3 = (formData.step3 || {}) as Record<string, unknown>;
        const supportedFieldKeys = collectSupportedObjectsFieldKeys(
          applicationTypeFields[appType] ?? [],
          applicationTypeIntegrationGroups[appType]
        );
        const ApplicationDetails = buildApplicationDetailsForNewApp(
          step3,
          appType,
          supportedFieldKeys
        );

        // 1) POST newApp — register application and get app id
        setSubmitProgressToast("Request Received...");
        const registerResult = await registerScimAppNewApp({
          ApplicationName: (formData.step2.applicationName || "").trim(),
          ApplicationType: appType,
          ApplicationDetails,
        });
        const appId = extractApplicationIdFromRegisterNewAppResponse(registerResult)?.trim() || "";
        persistAppInventoryTokenFromRegisterNewAppResponse(registerResult, appId);
        if (!appId) {
          throw new Error("Application registration did not return an application id");
        }
        setWizardRegisteredAppId(appId);

        // 2) POST mapfields — save schema mapping using app id from newApp
        setSubmitProgressToast("Update Schema mapping...");
        const provisioningAttrMap: Record<string, { variable: string }> = {};
        attributeMappingData.forEach((mapping) => {
          if (mapping.target?.trim()) {
            provisioningAttrMap[mapping.target.trim()] = {
              variable: mapping.source?.trim() ?? "",
            };
          }
        });
        await mapSchemaFields("ACMECOM", appId, {
          provisioningAttrMap,
          reconcilliationAttrMap: {},
        });

        const applicationName = (formData.step2.applicationName || "").trim();
        setSubmitProgressToast("Registering application instance...");
        await executeAddNewAppFunction(applicationName);

        setSubmitProgressToast("Updating application configuration...");
        const configuration = buildApplicationInstanceConfiguration(attributeMappingData);
        await executeUpdateApplicationInstanceConfiguration(appId, configuration);
      }

      setSubmitProgressToast("Application registered Successfully");
      await wait(800);
      router.push("/settings/app-inventory");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit application";
      setSubmitRequestError(message);
    } finally {
      setSubmitRequestLoading(false);
      setSubmitProgressToast(null);
    }
  };

  // Attribute mapping helper functions
  const getCurrentPageData = (): AttributeMapping[] => {
    const start = (attributeMappingPage - 1) * ATTR_MAPPING_PAGE_SIZE;
    const end = start + ATTR_MAPPING_PAGE_SIZE;
    return attributeMappingData.slice(start, end);
  };

  const getAttributeMappingTotalPages = (): number => {
    return Math.max(1, Math.ceil(attributeMappingData.length / ATTR_MAPPING_PAGE_SIZE));
  };

  // Fetch application types from API
  const fetchApplicationTypes = async () => {
    setIsLoadingAppTypes(true);
    try {
      console.log("Fetching application types from API...");
      const data = await getAllSupportedApplicationTypesViaProxy();
      console.log("API Response:", data);
      
      // Extract application types from API response
      // API returns: { applicationType: [{ "LDAP": [...] }, { "Generic LDAP": [...] }, ...] }
      if (data?.applicationType && Array.isArray(data.applicationType)) {
        const fieldMap: Record<string, string[]> = {};
        const integrationGroupMap: Record<string, ApplicationTypeIntegrationFieldGroup[]> = {};
        const extractedTypes: ApplicationTypeOption[] = [];
        for (const raw of data.applicationType as unknown[]) {
          const parsed = parseSupportedObjectsApplicationTypeItem(raw);
          if (!parsed) continue;
          fieldMap[parsed.typeName] = parsed.fields;
          if (parsed.integrationFieldGroups?.length) {
            integrationGroupMap[parsed.typeName] = parsed.integrationFieldGroups;
          }
          extractedTypes.push({
            id: parsed.typeName,
            title: parsed.typeName,
            subtitle: `${parsed.typeName} application type`,
            advancedSettingParts: parsed.advancedSettingParts,
          });
        }
        console.log("Extracted application types:", extractedTypes);
        setApplicationTypes(extractedTypes);
        setApplicationTypeFields(fieldMap);
        setApplicationTypeIntegrationGroups(integrationGroupMap);
      } else {
        console.warn("No applicationType found in API response or invalid format:", data);
      }
      
      // Extract OAuth types from API response
      // API returns: { oauthType: [{ "OKTA": [...] }, { "IDCS": [...] }, ...] }
      if (data?.oauthType && Array.isArray(data.oauthType)) {
        const oauthFieldMap: Record<string, string[]> = {};
        const extractedOauthTypes = data.oauthType.map((item: any) => {
          // Each item is an object with one key (the oauth type name)
          const key = Object.keys(item)[0];
          const fields = item[key];
          if (Array.isArray(fields)) oauthFieldMap[key] = normalizeSupportedObjectsFieldArray(fields);
          return key;
        });
        console.log("Extracted OAuth types:", extractedOauthTypes);
        setOauthTypes(extractedOauthTypes);
        setOauthTypeFields(oauthFieldMap);
      } else {
        console.warn("No oauthType found in API response or invalid format:", data);
      }
    } catch (error) {
      console.error("Error fetching application types:", error);
      setApplicationTypes([]);
      setOauthTypes([]);
      setApplicationTypeFields({});
      setApplicationTypeIntegrationGroups({});
      setOauthTypeFields({});
    } finally {
      setIsLoadingAppTypes(false);
    }
  };

  // Fetch application types on component mount
  useEffect(() => {
    fetchApplicationTypes();
  }, []);

  /** Block POST/GET to legacy IT Asset submitrequest while this page is mounted (stale chunks or stray callers). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const needle = "/itasset/ACMECOM/submitrequest";
    const nextFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes(needle)) {
        console.warn("[Add Application] Blocked IT Asset submitrequest:", url);
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return nextFetch(input, init);
    };
    return () => {
      window.fetch = nextFetch as typeof window.fetch;
    };
  }, []);

  // When in complete-integration mode, ensure step1.type matches a loaded application type so step 3 shows correct fields
  useEffect(() => {
    if (!isCompleteIntegration || !formData.step1.type || applicationTypes.length === 0) return;
    const currentType = formData.step1.type.trim();
    const hasExactMatch = applicationTypeFields[currentType] !== undefined;
    if (hasExactMatch) return;
    const matched = applicationTypes.find(
      (t) =>
        t.id === currentType ||
        t.title === currentType ||
        t.id.toLowerCase() === currentType.toLowerCase() ||
        t.title.toLowerCase() === currentType.toLowerCase()
    );
    if (matched) {
      setFormData((prev) => ({
        ...prev,
        step1: { ...prev.step1, type: matched.id },
      }));
    }
  }, [isCompleteIntegration, formData.step1.type, applicationTypes, applicationTypeFields]);

  // Fetch SCIM attributes from API
  const fetchScimAttributes = async () => {
    setIsLoadingAttributes(true);
    try {
      const response = await fetch("https://preview.keyforge.ai/schemamapper/getscim/ACMECOM", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SCIM attributes: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === "success" && Array.isArray(data.scimAttributes)) {
        const attrs = normalizeScimAttributesList(data.scimAttributes);
        setScimAttributes(attrs);
        setFilteredAttributes(filterScimAttributeList(attrs, scimDropdownSearchRef.current));
      } else {
        console.error("Invalid API response format");
        setScimAttributes([]);
        setFilteredAttributes([]);
      }
    } catch (error) {
      console.error("Error fetching SCIM attributes:", error);
      setScimAttributes([]);
      setFilteredAttributes([]);
    } finally {
      setIsLoadingAttributes(false);
    }
  };

  // Handle dropdown click - fetch attributes if not already fetched
  const handleDropdownToggle = () => {
    if (scimAttributes.length === 0 && !isLoadingAttributes) {
      fetchScimAttributes();
    }
    const nextOpen = !isDropdownOpen;
    setIsDropdownOpen(nextOpen);
    if (nextOpen) {
      filterAttributes(sourceAttributeValue, false);
    }
  };

  const handleEditDropdownToggle = () => {
    if (scimAttributes.length === 0 && !isLoadingAttributes) {
      fetchScimAttributes();
    }
    const nextOpen = !isEditDropdownOpen;
    setIsEditDropdownOpen(nextOpen);
    if (nextOpen) {
      filterAttributes(editSourceAttributeValue, true);
    }
  };

  // Filter attributes based on search input
  const filterAttributes = (searchTerm: string, isEdit: boolean = false) => {
    scimDropdownSearchRef.current = searchTerm;
    setFilteredAttributes(filterScimAttributeList(scimAttributes, searchTerm));

    if (isEdit) {
      setEditSourceAttributeValue(searchTerm);
    } else {
      setSourceAttributeValue(searchTerm);
    }
  };

  // Select an attribute from dropdown
  const selectAttribute = (attribute: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditSourceAttributeValue(attribute);
      setIsEditDropdownOpen(false);
    } else {
      setSourceAttributeValue(attribute);
      setIsDropdownOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        editDropdownRef.current &&
        !editDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEditDropdownOpen(false);
      }
      if (
        agentPoolDropdownRef.current &&
        !agentPoolDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAgentPoolDropdownOpen(false);
      }
      if (
        technicalOwnerDropdownRef.current &&
        !technicalOwnerDropdownRef.current.contains(event.target as Node)
      ) {
        setUserSearchField((f) => (f === "technicalOwner" ? null : f));
      }
      if (
        businessOwnerDropdownRef.current &&
        !businessOwnerDropdownRef.current.contains(event.target as Node)
      ) {
        setUserSearchField((f) => (f === "businessOwner" ? null : f));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch users once when Add Details step loads
  useEffect(() => {
    if (currentStep !== 2 || step2UserFetchedRef.current) return;
    step2UserFetchedRef.current = true;
    setUserSearchLoading(true);
    setUserSearchError(null);
    const query = `SELECT firstname, lastname, email, username, employeeid, department, title FROM usr`;
    executeQuery<{ resultSet?: any[] }>(query, [])
      .then((data) => {
        let usersData: UserSearchHit[] = [];
        if (data?.resultSet && Array.isArray(data.resultSet)) {
          usersData = data.resultSet.map((user: any, index: number) => {
            let emailValue = "";
            if (user.email) {
              if (typeof user.email === "string") emailValue = user.email;
              else if (user.email.work) emailValue = user.email.work;
              else if (Array.isArray(user.email) && user.email.length > 0) {
                const primary = user.email.find((e: any) => e.primary) || user.email[0];
                emailValue = primary?.value || "";
              }
            }
            const nameValue =
              [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username || "";
            return {
              id: `user-${index}-${user.username || user.email || index}`,
              name: nameValue,
              email: emailValue,
              username: user.username || "",
              department: user.department || "",
              jobTitle: user.title || "",
              employeeId: (user.employeeid != null && user.employeeid !== "") ? String(user.employeeid) : undefined,
            };
          });
        }
        setUserSearchAllUsers(usersData);
      })
      .catch((err) => {
        console.error("User search failed:", err);
        setUserSearchError(err instanceof Error ? err.message : "Failed to load users");
        setUserSearchAllUsers([]);
      })
      .finally(() => setUserSearchLoading(false));
  }, [currentStep]);

  const getStep3Trim = (key: string): string =>
    String((formData.step3 as Record<string, unknown>)[key] ?? "").trim();

  const isDatabaseOnboardType = isAiAgentWizard && formData.step1.type === "Database";
  const isScreenScrappingAiAgent =
    isAiAgentWizard && isAiAgentOnlyOnboardApplicationType(formData.step1.type);
  const isRestLikeOnboardType =
    isAiAgentWizard &&
    isRestLikeGroupedOnboardApplicationType(formData.step1.type) &&
    !isScreenScrappingAiAgent;
  const isGroupedSchemaOnboardType =
    isDatabaseOnboardType || isRestLikeOnboardType || isScreenScrappingAiAgent;
  const databaseViewName = pickViewGetAllUsersFromStep3(formData.step3 as Record<string, unknown>);
  const screenScrappingBaseUrl = pickScreenScrappingBaseUrlFromStep3(
    formData.step3 as Record<string, unknown>
  );
  const screenScrappingJsonFile = pickScreenScrappingJsonFromStep3(
    formData.step3 as Record<string, unknown>
  );
  const integrationSchemaSourceKey = isScreenScrappingAiAgent
    ? `${screenScrappingBaseUrl}::${screenScrappingJsonFile}::${String(
        formData.step3.screenScrapingJsonFileName ?? ""
      )}`
    : databaseViewName;
  const hasGetAllUsersValue = (): boolean => {
    if (isScreenScrappingAiAgent) {
      return isScreenScrappingIntegrationInputComplete(formData.step3 as Record<string, unknown>);
    }
    return Boolean(databaseViewName?.trim());
  };

  // Step 4 (Schema Mapping): load rows from schemamapper getmappedschema
  useEffect(() => {
    if (currentStep !== 4 || typeof window === "undefined") return;
    if (isAiAgentWizard && !isCompleteIntegration) return;
    if (isGroupedSchemaOnboardType && !isCompleteIntegration) return;
    const appId = (isCompleteIntegration ? appIdFromUrl?.trim() : wizardRegisteredAppId?.trim()) || "";
    if (!appId) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await getMappedSchema("ACMECOM", appId);
        if (cancelled) return;
        const rows = attributeMappingsFromGetMappedSchemaJson(json);
        if (rows.length > 0) {
          setAttributeMappingData(rows);
          setAttributeMappingPage(1);
        }
      } catch (e) {
        console.warn("getmappedschema failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentStep,
    isCompleteIntegration,
    appIdFromUrl,
    wizardRegisteredAppId,
    isGroupedSchemaOnboardType,
    isAiAgentWizard,
  ]);

  // Database / REST schema mapping: preload SCIM source attributes for row dropdowns
  useEffect(() => {
    if (currentStep !== 4 || !isGroupedSchemaOnboardType || isCompleteIntegration) return;
    if (!databaseSchemaLoaded) return;
    if (scimAttributes.length === 0 && !isLoadingAttributes) {
      fetchScimAttributes();
    }
  }, [
    currentStep,
    isGroupedSchemaOnboardType,
    isCompleteIntegration,
    databaseSchemaLoaded,
    scimAttributes.length,
    isLoadingAttributes,
  ]);

  useEffect(() => {
    if (isAiAgentWizard && isGroupedOnboardApplicationType(formData.step1.type)) {
      setGroupedIntegrationTab(CONNECTION_PARAMETERS_GROUP_ID);
      setTestConnectionFeedback(null);
    }
    if (!isAiAgentWizard || !isGroupedOnboardApplicationType(formData.step1.type)) {
      setDatabaseSessionId(null);
      setDatabaseSchemaLoaded(false);
      setFetchSchemaFeedback(null);
    }
  }, [formData.step1.type, isAiAgentWizard]);

  useEffect(() => {
    if (!isGroupedSchemaOnboardType) return;
    setDatabaseSchemaLoaded(false);
    setFetchSchemaFeedback(null);
    setAttributeMappingData([]);
    setAttributeMappingPage(1);
  }, [isGroupedSchemaOnboardType, integrationSchemaSourceKey]);

  const handleTestConnection = async () => {
    const appType = formData.step1.type?.trim() || "";
    if (!isAiAgentWizard || !isGroupedOnboardApplicationType(appType)) return;

    const groups = applicationTypeIntegrationGroups[appType] ?? [];
    const connGroup = groups.find((g) => g.id === CONNECTION_PARAMETERS_GROUP_ID);
    if (!connGroup?.fields.length) {
      setTestConnectionFeedback({
        type: "error",
        message: "Connection parameters are not configured for this application type.",
      });
      return;
    }

    setTestConnectionLoading(true);
    setTestConnectionFeedback(null);
    setFetchSchemaFeedback(null);
    try {
      let data: unknown;
      if (appType === "Database") {
        setDatabaseSessionId(null);
        setDatabaseSchemaLoaded(false);
        setAttributeMappingData([]);
        handleInputChange("step3", "dbSessionId", "");
        const dbPayload = buildDatabaseTestConnectionPayload(
          formData.step3 as Record<string, unknown>
        );
        if (!isDatabaseTestConnectionPayloadComplete(dbPayload)) {
          setTestConnectionFeedback({
            type: "error",
            message:
              "Enter database type, connection URL (e.g. localhost:5432/dbname or JDBC URL), username, and password.",
          });
          return;
        }
        data = await testDatabaseConnection(dbPayload);
      } else {
        const missing = connGroup.fields.filter((fk) => !getStep3Trim(fk));
        if (missing.length > 0) {
          setTestConnectionFeedback({
            type: "error",
            message: "Please fill in all connection parameter fields before testing.",
          });
          return;
        }
        const payload: Record<string, string> = {};
        connGroup.fields.forEach((fk) => {
          const v = getStep3Trim(fk);
          if (v) payload[fk] = v;
        });
        data =
          appType === "ScreenScrapping"
            ? await testScreenScrappingConnection(payload)
            : await testRestServiceConnection(payload);
      }
      const result = parseConnectionTestResult(data);
      if (appType === "Database" && result.ok) {
        if (!result.session_id) {
          setTestConnectionFeedback({
            type: "error",
            message: "Connection succeeded but no session id was returned.",
          });
          return;
        }
        setDatabaseSessionId(result.session_id);
        handleInputChange("step3", "dbSessionId", result.session_id);
      }
      setTestConnectionFeedback({
        type: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (err) {
      setTestConnectionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTestConnectionLoading(false);
    }
  };

  const handleScreenScrappingJsonUpload = (file: File) => {
    const isJsonFile =
      file.name.toLowerCase().endsWith(".json") ||
      file.type === "application/json" ||
      file.type === "text/json";
    if (!isJsonFile) {
      setFetchSchemaFeedback({
        type: "error",
        message: "Only JSON files are allowed.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        JSON.parse(text);
        setFormData((prev) => ({
          ...prev,
          step3: {
            ...prev.step3,
            [SCREEN_SCRAPPING_JSON_FILE_FIELD]: text,
            [SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD]: file.name,
          },
        }));
        setFetchSchemaFeedback(null);
      } catch {
        setFetchSchemaFeedback({
          type: "error",
          message: "Invalid JSON file. Upload a valid JSON document.",
        });
      }
    };
    reader.onerror = () => {
      setFetchSchemaFeedback({
        type: "error",
        message: "Failed to read the JSON file.",
      });
    };
    reader.readAsText(file);
  };

  const handleClearScreenScrappingJsonFile = () => {
    setFormData((prev) => ({
      ...prev,
      step3: {
        ...prev.step3,
        [SCREEN_SCRAPPING_JSON_FILE_FIELD]: "",
        [SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD]: "",
      },
    }));
    setFetchSchemaFeedback(null);
    if (screenScrappingJsonFileInputRef.current) {
      screenScrappingJsonFileInputRef.current.value = "";
    }
  };

  const handleFetchDatabaseSchema = async () => {
    const appType = formData.step1.type?.trim() || "";
    const step3 = formData.step3 as Record<string, unknown>;
    const view_name = pickViewGetAllUsersFromStep3(step3);

    if (appType === "ScreenScrapping") {
      if (!isScreenScrappingIntegrationInputComplete(step3)) {
        setFetchSchemaFeedback({
          type: "error",
          message: "Enter baseURL and upload a JSON file before loading schema.",
        });
        return;
      }
    } else if (!view_name) {
      setFetchSchemaFeedback({
        type: "error",
        message: "Enter Get All Users before loading schema.",
      });
      return;
    }

    if (isRestLikeGroupedOnboardApplicationType(appType)) {
      const schemaPayload =
        appType === "ScreenScrapping"
          ? buildScreenUsersSchemaPayload(step3)
          : buildRestUsersSchemaPayload(step3);

      setFetchSchemaLoading(true);
      setFetchSchemaFeedback(null);
      setSubmitRequestError(null);
      try {
        const data =
          appType === "ScreenScrapping"
            ? await fetchScreenUsersSchema(schemaPayload)
            : await fetchRestUsersSchema(schemaPayload);
        const rows = attributeMappingsFromRestUsersSchemaJson(data);
        if (rows.length === 0) {
          throw new Error(
            appType === "ScreenScrapping"
              ? "No columns were returned for this target URL."
              : "No columns were returned for this users URL."
          );
        }

        setAttributeMappingData(rows);
        setAttributeMappingPage(1);
        setDatabaseSchemaLoaded(true);
        setFetchSchemaFeedback({
          type: "success",
          message: `Loaded ${rows.length} column(s).`,
        });
        if (isAiAgentWizard) {
          setSubmitRequestError(null);
          setCurrentStep(4);
        }
      } catch (err) {
        setDatabaseSchemaLoaded(false);
        setFetchSchemaFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to fetch schema",
        });
      } finally {
        setFetchSchemaLoading(false);
      }
      return;
    }

    let sessionId = databaseSessionId?.trim() || getStep3Trim("dbSessionId");

    if (!sessionId) {
      setFetchSchemaFeedback({
        type: "error",
        message: "Test the connection first to obtain a session.",
      });
      return;
    }

    setFetchSchemaLoading(true);
    setFetchSchemaFeedback(null);
    setSubmitRequestError(null);
    try {
      const data = await fetchDatabaseSchema({
        session_id: sessionId,
        view_name,
        is_stored_procedure: false,
      });
      let rows = attributeMappingsFromFetchSchemaJson(data);
      if (rows.length === 0) {
        throw new Error("No columns were returned for this view.");
      }

      let suggestApplied = false;
      try {
        const suggestData = await fetchDatabaseSuggestMapping({
          session_id: sessionId,
          top_n: 3,
        });
        rows = applyDatabaseSuggestMappingToRows(rows, suggestData);
        suggestApplied = rows.some((r) => Boolean(r.bestMatch || r.option2));
      } catch (suggestErr) {
        console.warn("suggest-mapping failed:", suggestErr);
      }

      setAttributeMappingData(rows);
      setAttributeMappingPage(1);
      setDatabaseSchemaLoaded(true);
      setFetchSchemaFeedback({
        type: "success",
        message: suggestApplied
          ? `Loaded ${rows.length} column(s) with mapping suggestions.`
          : `Loaded ${rows.length} column(s). Mapping suggestions were unavailable; you can map attributes manually.`,
      });
      if (isAiAgentWizard && isGroupedOnboardApplicationType(appType)) {
        setSubmitRequestError(null);
        setCurrentStep(4);
      }
    } catch (err) {
      setDatabaseSchemaLoaded(false);
      setFetchSchemaFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to fetch schema",
      });
    } finally {
      setFetchSchemaLoading(false);
    }
  };

  const isDatabaseConnectionTestSuccessful = (): boolean =>
    testConnectionFeedback?.type === "success" &&
    Boolean(databaseSessionId?.trim() || getStep3Trim("dbSessionId"));

  const isIntegrationSchemaStepReady = (): boolean => {
    const hasView = hasGetAllUsersValue();
    if (!databaseSchemaLoaded || !hasView) return false;
    if (isRestLikeGroupedOnboardApplicationType(formData.step1.type) && !isScreenScrappingAiAgent) {
      return true;
    }
    if (isScreenScrappingAiAgent) return true;
    return Boolean(databaseSessionId?.trim() || getStep3Trim("dbSessionId"));
  };

  const isIntegrationStepThreeReady = (): boolean => isIntegrationSchemaStepReady();

  // Filter loaded users by current input (client-side only)
  const getFilteredOwnerUsers = (field: OwnerField): UserSearchHit[] => {
    const term = (field === "technicalOwner" ? formData.step2.technicalOwner : formData.step2.businessOwner)
      .trim().toLowerCase();
    if (!term) return userSearchAllUsers;
    return userSearchAllUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        (u.department && u.department.toLowerCase().includes(term)) ||
        (u.jobTitle && u.jobTitle.toLowerCase().includes(term)) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(term))
    );
  };

  const handleOwnerInputChange = (field: OwnerField, value: string) => {
    handleInputChange("step2", field, value);
    setUserSearchError(null);
    if (value.trim()) setUserSearchField(field);
    else setUserSearchField(null);
  };

  const handleOwnerSelect = (field: OwnerField, user: UserSearchHit) => {
    const display = user.name ? (user.email ? `${user.name} (${user.email})` : user.name) : user.email || user.username;
    handleInputChange("step2", field, display);
    // Store username instead of email for payload owner.value
    handleInputChange("step2", field === "technicalOwner" ? "technicalOwnerEmail" : "businessOwnerEmail", user.username || "");
    setUserSearchField(null);
  };

  // Initialize edit source attribute value when editing starts
  useEffect(() => {
    if (isEditingAttribute && editingAttribute) {
      setEditSourceAttributeValue(editingAttribute.source || "");
    }
  }, [isEditingAttribute, editingAttribute]);

  // Schema Mapping: Add new row (same behavior as SchemaMappingTab)
  const handleAddMapping = () => {
    const source = sourceAttributeValue.trim();
    const target = targetAttributeValue.trim();
    if (!source || !target) return;
    setAttributeMappingData((prev) => [
      ...(keyfieldChecked ? prev.map((m) => ({ ...m, keyfieldMapping: false })) : prev),
      {
        id: `new-${Date.now()}`,
        source,
        target,
        defaultValue: defaultAttributeValue?.trim() ?? "",
        type: mappingType || "direct",
        keyfieldMapping: keyfieldChecked,
      },
    ]);
    setSourceAttributeValue("");
    setTargetAttributeValue("");
    setDefaultAttributeValue("");
    setKeyfieldChecked(false);
    setMappingType("direct");
    setIsDropdownOpen(false);
  };

  // Schema Mapping: Update existing row (same behavior as SchemaMappingTab)
  const saveEdit = () => {
    if (!editingAttribute?.id) return;
    const source = (editSourceAttributeValue || editingAttribute.source || "").trim();
    const isKeyfield = editingAttribute.keyfieldMapping ?? false;
    setAttributeMappingData((prev) =>
      prev.map((m) => {
        if (m.id === editingAttribute.id) {
          return {
            ...m,
            source,
            target: (editingAttribute.target || "").trim(),
            defaultValue: editingAttribute.defaultValue ?? "",
            type: editingAttribute.type || "direct",
            keyfieldMapping: isKeyfield,
          };
        }
        return isKeyfield ? { ...m, keyfieldMapping: false } : m;
      })
    );
    setIsEditingAttribute(false);
    setEditingAttribute(null);
    setEditSourceAttributeValue("");
    setIsEditDropdownOpen(false);
  };

  // Schema Mapping: Delete row (same behavior as SchemaMappingTab)
  const handleDeleteMapping = (id: string) => {
    if (!id) return;
    setAttributeMappingData((prev) => prev.filter((m) => m.id !== id));
    if (editingAttribute?.id === id) {
      setIsEditingAttribute(false);
      setEditingAttribute(null);
      setEditSourceAttributeValue("");
      setIsEditDropdownOpen(false);
    }
  };

  // Shared UI for Disconnected Application integration fields
  const renderDisconnectedApplicationFields = () => {
    const manuallyFulfillChecked =
      formData.step3.manuallyFulfill === undefined ||
      formData.step3.manuallyFulfill === null ||
      formData.step3.manuallyFulfill === true;

                return (
                  <div className="space-y-6">
        {/* Manually Fulfill toggle */}
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              checked={manuallyFulfillChecked}
              onChange={(e) =>
                handleInputChange("step3", "manuallyFulfill", e.target.checked)
              }
            />
            <span className="ml-2 text-sm text-gray-700">
              Manually fulfill all access requests
            </span>
          </label>
        </div>

        {/* Remaining Integration Settings – only when NOT manually fulfilled */}
        {!manuallyFulfillChecked && (
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="text"
                value={formData.step3.raiseTicket || ""}
                onChange={(e) => handleInputChange("step3", "raiseTicket", e.target.value)}
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                placeholder=" "
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step3.raiseTicket
                    ? "top-0.5 text-xs text-blue-600"
                    : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Raise Ticket *
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.step3.ticketingSystem || ""}
                onChange={(e) =>
                  handleInputChange("step3", "ticketingSystem", e.target.value)
                }
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                placeholder=" "
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step3.ticketingSystem
                    ? "top-0.5 text-xs text-blue-600"
                    : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Ticketing System *
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.step3.ticketingAppId || ""}
                onChange={(e) =>
                  handleInputChange("step3", "ticketingAppId", e.target.value)
                }
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                placeholder=" "
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step3.ticketingAppId
                    ? "top-0.5 text-xs text-blue-600"
                    : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Ticketing App ID *
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                value={formData.step3.ticketingAPIToken || ""}
                onChange={(e) =>
                  handleInputChange("step3", "ticketingAPIToken", e.target.value)
                }
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                placeholder=" "
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step3.ticketingAPIToken
                    ? "top-0.5 text-xs text-blue-600"
                    : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Ticketing API Token *
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.step3.assignTo || ""}
                onChange={(e) => handleInputChange("step3", "assignTo", e.target.value)}
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                placeholder=" "
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step3.assignTo
                    ? "top-0.5 text-xs text-blue-600"
                    : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Assign To *
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                value={formData.step3.oimAPIToken || ""}
                onChange={(e) => handleInputChange("step3", "oimAPIToken", e.target.value)}
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                placeholder=" "
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step3.oimAPIToken
                    ? "top-0.5 text-xs text-blue-600"
                    : "top-3.5 text-sm text-gray-500"
                }`}
              >
                OIM API Token *
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  const normalizeMappingLabel = (value: string | undefined): string =>
    (value ?? "").trim().toLowerCase();

  const getDatabaseMappingPick = (
    mapping: AttributeMapping
  ): DatabaseMappingSourceSelection | "" => {
    if (mapping.sourceSelection) return mapping.sourceSelection;
    const src = normalizeMappingLabel(mapping.source);
    if (!src) return "";
    if (mapping.bestMatch && src === normalizeMappingLabel(mapping.bestMatch)) {
      return "bestMatch";
    }
    if (mapping.option2 && src === normalizeMappingLabel(mapping.option2)) {
      return "option2";
    }
    return mapping.source?.trim() ? "custom" : "";
  };

  const setDatabaseMappingPick = (
    rowId: string,
    pick: DatabaseMappingSourceSelection
  ) => {
    setAttributeMappingData((prev) =>
      prev.map((m) => {
        if (m.id !== rowId) return m;
        if (pick === "bestMatch") {
          return {
            ...m,
            sourceSelection: pick,
            source: m.bestMatch?.trim() ?? "",
          };
        }
        if (pick === "option2") {
          return {
            ...m,
            sourceSelection: pick,
            source: m.option2?.trim() ?? "",
          };
        }
        return { ...m, sourceSelection: pick };
      })
    );
  };

  const updateDatabaseMappingSource = (
    id: string,
    source: string,
    selection: DatabaseMappingSourceSelection = "custom"
  ) => {
    setAttributeMappingData((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, source, sourceSelection: selection } : m
      )
    );
  };

  /** SCIM list for database mapping dropdown (includes row suggestions + full SCIM catalog). */
  const databaseMappingDropdownOptions = (mapping: AttributeMapping | undefined): string[] => {
    const seen = new Set<string>();
    const add = (v: string | undefined) => {
      const t = v?.trim();
      if (t && !seen.has(t)) seen.add(t);
    };
    for (const attr of scimAttributes) add(attr);
    if (mapping) {
      add(mapping.source);
      add(mapping.bestMatch);
      add(mapping.option2);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  };

  const dbMappingOpenRow = dbMappingOpenRowId
    ? attributeMappingData.find((m) => m.id === dbMappingOpenRowId)
    : undefined;

  /** SCIM options for database mapping dropdown, filtered by the row search input. */
  const dbMappingDropdownOptions = useMemo(() => {
    const base = databaseMappingDropdownOptions(dbMappingOpenRow);
    return filterScimAttributeList(base, dbMappingFilter);
  }, [dbMappingOpenRowId, dbMappingFilter, scimAttributes, attributeMappingData]);

  const syncDbMappingDropdownPosition = useCallback(() => {
    if (!dbMappingOpenRowId) return;
    const anchor = dbMappingAnchorRefs.current[dbMappingOpenRowId];
    if (anchor) setDbMappingDropdownRect(anchor.getBoundingClientRect());
  }, [dbMappingOpenRowId]);

  const openDbMappingDropdown = (rowId: string) => {
    const mapping = attributeMappingData.find((m) => m.id === rowId);
    setDbMappingFilter(mapping?.source ?? "");
    setDbMappingOpenRowId(rowId);
    const anchor = dbMappingAnchorRefs.current[rowId];
    if (anchor) setDbMappingDropdownRect(anchor.getBoundingClientRect());
    if (scimAttributes.length === 0 && !isLoadingAttributes) {
      fetchScimAttributes();
    }
  };

  const selectDbMappingAttribute = (rowId: string, attr: string) => {
    updateDatabaseMappingSource(rowId, attr, "custom");
    setDbMappingFilter(attr);
    setDbMappingOpenRowId(null);
    setDbMappingDropdownRect(null);
  };

  useEffect(() => {
    if (!dbMappingOpenRowId) return;
    syncDbMappingDropdownPosition();
    const onScrollOrResize = () => syncDbMappingDropdownPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [dbMappingOpenRowId, syncDbMappingDropdownPosition]);

  useEffect(() => {
    if (!dbMappingOpenRowId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const anchor = dbMappingAnchorRefs.current[dbMappingOpenRowId];
      if (anchor?.contains(target)) return;
      if (dbMappingDropdownPortalRef.current?.contains(target)) return;
      setDbMappingOpenRowId(null);
      setDbMappingDropdownRect(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [dbMappingOpenRowId]);

  const renderDatabaseSchemaMappingStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
          Schema Mapping
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          Map each database column by selecting exactly one option: Best Match, Option 2, or Source
          Attribute.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-visible">
        <table className="w-full table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source Attribute
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Best Match
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Option 2
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source Attribute
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {getCurrentPageData().length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  No columns loaded. Return to Integration and click Load Schema.
                </td>
              </tr>
            ) : (
              getCurrentPageData().map((mapping, index) => {
                const mappingPick = getDatabaseMappingPick(mapping);
                const mappingRadioName = `db-mapping-${mapping.id}`;
                const isCustomPick = mappingPick === "custom";

                return (
                <tr key={mapping.id ?? `db-row-${index}`}>
                  <td
                    className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-pre-wrap break-words align-top"
                    title={mapping.target}
                  >
                    {mapping.target || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    {mapping.bestMatch ? (
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name={mappingRadioName}
                          className="mt-0.5 w-4 h-4 shrink-0 text-blue-600 border-gray-300 focus:ring-blue-500"
                          checked={mappingPick === "bestMatch"}
                          onChange={() => setDatabaseMappingPick(mapping.id, "bestMatch")}
                          aria-label={`Select best match ${mapping.bestMatch} for ${mapping.target}`}
                        />
                        <span className="text-gray-900 break-words group-hover:text-blue-700">
                          {mapping.bestMatch}
                        </span>
                      </label>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    {mapping.option2 ? (
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name={mappingRadioName}
                          className="mt-0.5 w-4 h-4 shrink-0 text-blue-600 border-gray-300 focus:ring-blue-500"
                          checked={mappingPick === "option2"}
                          onChange={() => setDatabaseMappingPick(mapping.id, "option2")}
                          aria-label={`Select option 2 ${mapping.option2} for ${mapping.target}`}
                        />
                        <span className="text-gray-900 break-words group-hover:text-blue-700">
                          {mapping.option2}
                        </span>
                      </label>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top min-w-[12rem]">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name={mappingRadioName}
                        className="mt-2.5 w-4 h-4 shrink-0 text-blue-600 border-gray-300 focus:ring-blue-500"
                        checked={isCustomPick}
                        onChange={() => {
                          setDatabaseMappingPick(mapping.id, "custom");
                          openDbMappingDropdown(mapping.id);
                        }}
                        aria-label={`Select custom source attribute for ${mapping.target}`}
                      />
                      <div
                        className="relative flex-1 overflow-visible"
                        ref={(el) => {
                          dbMappingAnchorRefs.current[mapping.id] = el;
                        }}
                      >
                      <input
                        type="text"
                        className="w-full px-3 py-2 pr-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
                        value={
                          dbMappingOpenRowId === mapping.id
                            ? dbMappingFilter
                            : mapping.source || ""
                        }
                        disabled={
                          !isCustomPick ||
                          (isLoadingAttributes && scimAttributes.length === 0)
                        }
                        placeholder={
                          isLoadingAttributes
                            ? "Loading attributes…"
                            : "Select or enter source attribute"
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setDbMappingFilter(value);
                          updateDatabaseMappingSource(mapping.id, value, "custom");
                          if (dbMappingOpenRowId !== mapping.id) {
                            openDbMappingDropdown(mapping.id);
                          }
                        }}
                        onFocus={() => {
                          setDatabaseMappingPick(mapping.id, "custom");
                          openDbMappingDropdown(mapping.id);
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        disabled={
                          !isCustomPick ||
                          (isLoadingAttributes && scimAttributes.length === 0)
                        }
                        aria-label="Toggle source attribute list"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDatabaseMappingPick(mapping.id, "custom");
                          if (dbMappingOpenRowId === mapping.id) {
                            setDbMappingOpenRowId(null);
                            setDbMappingDropdownRect(null);
                          } else {
                            openDbMappingDropdown(mapping.id);
                          }
                        }}
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            dbMappingOpenRowId === mapping.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setAttributeMappingPage(Math.max(1, attributeMappingPage - 1))}
            disabled={attributeMappingPage === 1}
          >
            &lt;
          </button>
          <span className="text-sm text-gray-700">
            Page {attributeMappingPage} of {getAttributeMappingTotalPages()}
          </span>
          <button
            type="button"
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            onClick={() =>
              setAttributeMappingPage(
                Math.min(getAttributeMappingTotalPages(), attributeMappingPage + 1)
              )
            }
            disabled={attributeMappingPage === getAttributeMappingTotalPages()}
          >
            &gt;
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {attributeMappingData.length} column(s) · mappings are saved when you submit the
          application
        </p>
      </div>

      {dbMappingOpenRowId &&
        dbMappingDropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dbMappingDropdownPortalRef}
            className="fixed z-[200] bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto overflow-x-hidden"
            style={{
              top: dbMappingDropdownRect.bottom + 4,
              left: dbMappingDropdownRect.left,
              width: Math.max(dbMappingDropdownRect.width, 220),
            }}
          >
            {isLoadingAttributes ? (
              <div className="px-4 py-2 text-sm text-gray-500">Loading attributes…</div>
            ) : dbMappingDropdownOptions.length > 0 ? (
              dbMappingDropdownOptions.map((attr, index) => (
                <button
                  key={`${attr}-${index}`}
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectDbMappingAttribute(dbMappingOpenRowId, attr)}
                >
                  {attr}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );

  // Shared Schema Mapping step content (used for both normal and disconnected flows)
  const renderSchemaMappingStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Existing Mappings Table */}
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source Attribute
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Attribute
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Default Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentPageData().length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      No attribute mappings configured.
                    </td>
                  </tr>
                ) : (
                  getCurrentPageData().map((mapping, index) => (
                    <tr key={mapping.id ?? `row-${index}`}>
                      <td
                        className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap break-words break-all align-top"
                        style={{
                          position: "static",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {mapping.source}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap break-words break-all align-top"
                        style={{
                          position: "static",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {mapping.target}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {mapping.defaultValue || ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            aria-label="Edit"
                            onClick={() => {
                              setEditingAttribute(mapping);
                              setIsEditingAttribute(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            aria-label="Delete"
                            onClick={() => handleDeleteMapping(mapping.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setAttributeMappingPage(Math.max(1, attributeMappingPage - 1))}
                disabled={attributeMappingPage === 1}
              >
                &lt;
              </button>
              <span className="text-sm text-gray-700">
                Page {attributeMappingPage} of {getAttributeMappingTotalPages()}
              </span>
              <button
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                onClick={() =>
                  setAttributeMappingPage(
                    Math.min(getAttributeMappingTotalPages(), attributeMappingPage + 1)
                  )
                }
                disabled={attributeMappingPage === getAttributeMappingTotalPages()}
              >
                &gt;
              </button>
            </div>
          </div>

          {/* Action Buttons - Save calls saveappdetails API in edit mode */}
          <div className="flex space-x-3">
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={submitRequestLoading}
              onClick={async () => {
                setSubmitRequestError(null);
                setSubmitRequestLoading(true);
                try {
                  const ownerEmail =
                    formData.step2.technicalOwnerEmail || formData.step2.businessOwnerEmail || "";
                  const step3 = formData.step3 || {};
                  const provisioningAttrMap: Record<string, { variable: string }> = {};
                  attributeMappingData.forEach((mapping) => {
                    if (mapping.target?.trim()) {
                      provisioningAttrMap[mapping.target.trim()] = {
                        variable: mapping.source?.trim() ?? "",
                      };
                    }
                  });
                  const userSearchBaseVal = String(
                    step3.userSearchBase ?? step3.user_searchBase ?? ""
                  ).trim();
                  const groupSearchBaseVal = String(
                    step3.groupSearchBase ?? step3.group_searchBase ?? ""
                  ).trim();
                  const {
                    userSearchBase: _u2,
                    groupSearchBase: _g2,
                    user_searchBase: _ub2,
                    group_searchBase: _gb2,
                    ...step3Rest
                  } = step3 as Record<string, unknown>;
                  const connectionDetails: Record<string, unknown> = {
                    ...step3Rest,
                    hostname: step3.hostname ?? "",
                    port: step3.port ?? "",
                    username: step3.username ?? "",
                    password: step3.password ?? "",
                    user_searchBase: userSearchBaseVal,
                    group_searchBase: groupSearchBaseVal,
                  };
                  const savePayload = {
                    tenantId: "ACMECOM",
                    appid: appIdFromUrl || "",
                    serviceURL: "",
                    name: formData.step2.applicationName || "",
                    description: formData.step2.description || "",
                    category: formData.step1.type || "",
                    owner: { type: "User", value: ownerEmail },
                    status: "InProgress",
                    connectionDetails,
                    dicoveredOn: null,
                    integratedOn: null,
                    schemaMappingDetails: {
                      provisioningAttrMap,
                      reconcilliationAttrMap: {},
                    },
                    applicationConfigurationDetails: null,
                    iga: false,
                    lcm: false,
                    sso: false,
                    ...(appIdFromUrl && !Number.isNaN(Number(appIdFromUrl))
                      ? { key: Number(appIdFromUrl) }
                      : {}),
                  };
                  await saveAppDetails(savePayload);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Failed to save application details";
                  setSubmitRequestError(message);
                } finally {
                  setSubmitRequestLoading(false);
                }
              }}
            >
              {submitRequestLoading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
              onClick={() => router.push("/settings/app-inventory")}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Add New Attribute Form or Edit Attribute Form */}
        <div className="space-y-4">
          {isEditingAttribute ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mapping Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingAttribute?.type ?? "direct"}
                    onChange={(e) =>
                      setEditingAttribute((prev) =>
                        prev ? { ...prev, type: e.target.value } : null
                      )
                    }
                  >
                    <option value="direct">Direct</option>
                    <option value="expression">Expression</option>
                    <option value="constant">Constant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Attribute
                    <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingAttribute?.target ?? ""}
                    onChange={(e) =>
                      setEditingAttribute((prev) =>
                        prev ? { ...prev, target: e.target.value } : null
                      )
                    }
                  />
                  <div className="mt-2 flex justify-end">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={editingAttribute?.keyfieldMapping ?? false}
                        onChange={(e) =>
                          setEditingAttribute((prev) =>
                            prev ? { ...prev, keyfieldMapping: e.target.checked } : null
                          )
                        }
                      />
                      <span className="ml-2 text-sm text-gray-700">Keyfield</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Attribute
                    <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                    <span className="text-xs text-gray-500 ml-1">Help</span>
                  </label>
                  <div className="relative" ref={editDropdownRef}>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editSourceAttributeValue || editingAttribute?.source || ""}
                      onChange={(e) => {
                        filterAttributes(e.target.value, true);
                      }}
                      onFocus={() => {
                        if (scimAttributes.length === 0 && !isLoadingAttributes) {
                          fetchScimAttributes();
                        }
                        setIsEditDropdownOpen(true);
                        filterAttributes(editSourceAttributeValue || editingAttribute?.source || "", true);
                      }}
                      placeholder="Select or enter source attribute"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      onClick={handleEditDropdownToggle}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isEditDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isEditDropdownOpen && (
                      <div
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
                        style={{ scrollBehavior: "smooth" }}
                      >
                        {isLoadingAttributes ? (
                          <div className="px-4 py-2 text-sm text-gray-500">Loading attributes...</div>
                        ) : filteredAttributes.length > 0 ? (
                          filteredAttributes.map((attr, index) => (
                            <div
                              key={index}
                              className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => selectAttribute(attr, true)}
                            >
                              {attr}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default value (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter default value"
                    value={editingAttribute?.defaultValue ?? ""}
                    onChange={(e) =>
                      setEditingAttribute((prev) =>
                        prev ? { ...prev, defaultValue: e.target.value } : null
                      )
                    }
                  />
                </div>
              </div>

              {/* Edit Form Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  onClick={saveEdit}
                >
                  Update
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                  onClick={() => {
                    setIsEditingAttribute(false);
                    setEditingAttribute(null);
                    setEditSourceAttributeValue("");
                    setIsEditDropdownOpen(false);
                  }}
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mapping Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={mappingType ?? "direct"}
                    onChange={(e) => setMappingType(e.target.value)}
                  >
                    <option value="direct">Direct</option>
                    <option value="expression">Expression</option>
                    <option value="constant">Constant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Attribute
                    <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                    <span className="text-xs text-gray-500 ml-1">Help</span>
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={sourceAttributeValue ?? ""}
                      onChange={(e) => {
                        filterAttributes(e.target.value, false);
                      }}
                      onFocus={() => {
                        if (scimAttributes.length === 0 && !isLoadingAttributes) {
                          fetchScimAttributes();
                        }
                        setIsDropdownOpen(true);
                        filterAttributes(sourceAttributeValue, false);
                      }}
                      placeholder="Select or enter source attribute"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      onClick={handleDropdownToggle}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isDropdownOpen && (
                      <div
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-height-60 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
                        style={{ scrollBehavior: "smooth", maxHeight: "15rem" }}
                      >
                        {isLoadingAttributes ? (
                          <div className="px-4 py-2 text-sm text-gray-500">Loading attributes...</div>
                        ) : filteredAttributes.length > 0 ? (
                          filteredAttributes.map((attr, index) => (
                            <div
                              key={index}
                              className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => selectAttribute(attr, false)}
                            >
                              {attr}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Attribute
                    <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter target attribute"
                      value={targetAttributeValue ?? ""}
                      onChange={(e) => setTargetAttributeValue(e.target.value)}
                    />
                    <button className="absolute right-2 top-2 text-gray-400">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={keyfieldChecked}
                        onChange={(e) => setKeyfieldChecked(e.target.checked)}
                      />
                      <span className="ml-2 text-sm text-gray-700">Keyfield</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default value (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter default value"
                    value={defaultAttributeValue ?? ""}
                    onChange={(e) => setDefaultAttributeValue(e.target.value)}
                  />
                </div>
              </div>

              {/* Add Form Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!sourceAttributeValue.trim() || !targetAttributeValue.trim()}
                  onClick={handleAddMapping}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                  onClick={() => {
                    setSourceAttributeValue("");
                    setTargetAttributeValue("");
                    setDefaultAttributeValue("");
                    setKeyfieldChecked(false);
                    setMappingType("direct");
                    setIsDropdownOpen(false);
                  }}
                >
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderFinishUpSummary = () => {
    const appType = formData.step1.type?.trim() || "";
    const isDisconnected = appType === "Disconnected Application";
    const isFlatfile = appType === "Flatfile";

    const SummarySection = ({
      title,
      children,
    }: {
      title: string;
      children: React.ReactNode;
    }) => (
      <section className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        <dl className="px-4 py-3 space-y-0">{children}</dl>
      </section>
    );

    const SummaryRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
      <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-slate-100 last:border-0">
        <dt className="sm:w-44 shrink-0 text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </dt>
        <dd className="min-w-0 text-sm text-slate-900 break-words">{value ?? "—"}</dd>
      </div>
    );

    const maskIfSensitive = (key: string, value: unknown): string => {
      if (value == null || value === "") return "—";
      if (/password|secret|token|credential/i.test(key)) return "••••••••";
      if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    };

    const integrationGroups = applicationTypeIntegrationGroups[appType] ?? [];
    const integrationRows: { label: string; value: string }[] = [];
    for (const group of integrationGroups) {
      for (const fieldKey of group.fields) {
        const raw = (formData.step3 as Record<string, unknown>)[fieldKey];
        integrationRows.push({
          label: fieldKey.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
          value: maskIfSensitive(fieldKey, raw),
        });
      }
    }

    if (integrationRows.length === 0 && !isFlatfile && !isDisconnected) {
      const skipKeys = new Set([
        "fieldOrder",
        "multivaluedField",
        "integrationSettings",
      ]);
      Object.entries(formData.step3 as Record<string, unknown>).forEach(([key, val]) => {
        if (skipKeys.has(key) || val == null || val === "") return;
        if (Array.isArray(val) && val.length === 0) return;
        integrationRows.push({
          label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
          value: maskIfSensitive(key, val),
        });
      });
    }

    const flatfilePreviewCount = (() => {
      const data = flatfileMetadataUsers as { preview?: unknown[] } | unknown[] | null;
      if (!data) return 0;
      if (!Array.isArray(data) && Array.isArray((data as { preview?: unknown[] }).preview)) {
        return (data as { preview: unknown[] }).preview.length;
      }
      return Array.isArray(data) ? data.length : 0;
    })();

    const disconnectedPreviewCount = (() => {
      const data = disconnectedMetadataUsers as { preview?: unknown[] } | unknown[] | null;
      if (!data) return 0;
      if (!Array.isArray(data) && Array.isArray((data as { preview?: unknown[] }).preview)) {
        return (data as { preview: unknown[] }).preview.length;
      }
      return Array.isArray(data) ? data.length : 0;
    })();

    const mappingPreview = attributeMappingData.slice(0, 8);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review &amp; finish</h2>
          <p className="text-sm text-gray-600 mt-1">
            Summary of your application configuration across all wizard steps.
          </p>
        </div>

        {!isCompleteIntegration && (
          <SummarySection title="1. Select System">
            <SummaryRow label="Application type" value={appType || "—"} />
            {formData.step1.oauthType ? (
              <SummaryRow label="OAuth type" value={formData.step1.oauthType} />
            ) : null}
          </SummarySection>
        )}

        <SummarySection title={isCompleteIntegration ? "1. Application details" : "2. Add Details"}>
          <SummaryRow label="Application name" value={formData.step2.applicationName} />
          <SummaryRow
            label="Description"
            value={formData.step2.description?.trim() ? formData.step2.description : "—"}
          />
          <SummaryRow label="Technical owner" value={formData.step2.technicalOwner} />
          <SummaryRow label="Business owner" value={formData.step2.businessOwner} />
          <SummaryRow label="Technical owner email" value={formData.step2.technicalOwnerEmail} />
          <SummaryRow label="Business owner email" value={formData.step2.businessOwnerEmail} />
          <SummaryRow
            label="Source type"
            value={formData.step2.sourceType?.trim() || "—"}
          />
        </SummarySection>

        {isFlatfile ? (
          <SummarySection title={isCompleteIntegration ? "2. File upload" : "3. File upload"}>
            <SummaryRow
              label="Uploaded file"
              value={flatfileFileRef.current?.name ?? "No file selected"}
            />
            <SummaryRow label="Field delimiter" value={String(formData.step3.fieldDelimiter ?? "—")} />
            <SummaryRow
              label="Multivalue delimiter"
              value={String(formData.step3.multivalueDelimiter ?? "—")}
            />
            <SummaryRow label="Preview rows" value={String(flatfilePreviewCount)} />
            <SummaryRow
              label="Fields configured"
              value={
                Array.isArray(formData.step3.fieldOrder) && formData.step3.fieldOrder.length > 0
                  ? `${formData.step3.fieldOrder.length} field(s)`
                  : "—"
              }
            />
          </SummarySection>
        ) : isDisconnected ? (
          <>
            <SummarySection title={isCompleteIntegration ? "2. Integration settings" : "3. Integration settings"}>
              {integrationRows.length === 0 ? (
                <SummaryRow label="Configuration" value="No integration fields configured" />
              ) : (
                integrationRows.map((row) => (
                  <SummaryRow key={row.label} label={row.label} value={row.value} />
                ))
              )}
            </SummarySection>
            <SummarySection title={isCompleteIntegration ? "3. File upload" : "4. File upload"}>
              <SummaryRow
                label="Uploaded file"
                value={disconnectedFile?.name ?? "No file selected"}
              />
              <SummaryRow label="Preview rows" value={String(disconnectedPreviewCount)} />
              <SummaryRow
                label="Metadata saved"
                value={disconnectedMetadataSaved ? "Yes" : "No"}
              />
            </SummarySection>
          </>
        ) : appType === "Database" ? (
          <SummarySection title={isCompleteIntegration ? "2. Integration settings" : "3. Integration settings"}>
            {integrationRows.length === 0 ? (
              <SummaryRow label="Configuration" value="No integration fields configured" />
            ) : (
              integrationRows.map((row) => (
                <SummaryRow key={row.label} label={row.label} value={row.value} />
              ))
            )}
            <SummaryRow
              label="Get All Users"
              value={pickViewGetAllUsersFromStep3(formData.step3 as Record<string, unknown>) || "—"}
            />
            <SummaryRow
              label="Connection session"
              value={databaseSessionId || getStep3Trim("dbSessionId") || "—"}
            />
            <SummaryRow
              label="Schema loaded"
              value={
                databaseSchemaLoaded
                  ? `Yes (${attributeMappingData.length} column(s))`
                  : "No"
              }
            />
          </SummarySection>
        ) : (
          <SummarySection title={isCompleteIntegration ? "2. Integration settings" : "3. Integration settings"}>
            {integrationRows.length === 0 ? (
              <SummaryRow label="Configuration" value="No integration fields configured" />
            ) : (
              integrationRows.map((row) => (
                <SummaryRow key={row.label} label={row.label} value={row.value} />
              ))
            )}
          </SummarySection>
        )}

        <SummarySection
          title={
            isDisconnected
              ? isCompleteIntegration
                ? "4. Schema mapping"
                : "5. Schema mapping"
              : isCompleteIntegration
                ? "3. Schema mapping"
                : "4. Schema mapping"
          }
        >
          <SummaryRow
            label="Mappings"
            value={
              attributeMappingData.length === 0
                ? "No mappings configured"
                : `${attributeMappingData.length} mapping(s)`
            }
          />
          {mappingPreview.length > 0 ? (
            <div className="py-2">
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Mapping preview
              </dt>
              <dd>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {appType === "Database" ? "Column" : "Source"}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {appType === "Database" ? "Source attribute" : "Target"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mappingPreview.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2 text-slate-800">
                            {appType === "Database" ? m.target || "—" : m.source || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-800">
                            {appType === "Database" ? m.source || "—" : m.target || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {attributeMappingData.length > mappingPreview.length ? (
                  <p className="text-xs text-slate-500 mt-2">
                    +{attributeMappingData.length - mappingPreview.length} more mapping(s)
                  </p>
                ) : null}
              </dd>
            </div>
          ) : null}
        </SummarySection>

      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
             <div className="flex w-full items-center justify-between gap-3 min-w-0">
               <span className="text-sm font-medium text-gray-700 shrink-0">
                 Application Type *
               </span>
               <div className="min-w-0 flex-1 flex justify-end">
                 <input
                   id="app-type-search"
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   aria-label="Search application types"
                   className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="Filter application types…"
                 />
               </div>
             </div>
             {isLoadingAppTypes ? (
                 <div className="flex items-center justify-center p-8">
                   <div className="text-gray-500">Loading application types...</div>
                 </div>
               ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                 {(searchQuery === "" ||
                   "active directory powershell connector".includes(searchQuery.toLowerCase()) ||
                   "active directory".includes(searchQuery.toLowerCase())) && (() => {
                   const isStaticAdSelected =
                     formData.step1.type === "Active Directory Powershell Connector" &&
                     !formData.step1.aiAgentOnboard;
                   return (
                     <div
                       key="static-active-directory-powershell-connector"
                       onClick={() =>
                         toggleStep1ApplicationType("Active Directory Powershell Connector", false)
                       }
                       className={`p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                         isStaticAdSelected
                           ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                           : "border-gray-200 bg-white hover:border-gray-300"
                       }`}
                     >
                       <div className="flex items-start gap-2.5">
                         <div
                           className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                           aria-hidden
                         >
                           <AppTypeCardIcon typeId="Active Directory Powershell Connector" />
                         </div>
                         <div className="min-w-0 flex-1">
                           <h3 className="font-medium text-gray-900 text-sm leading-snug">
                             Active Directory Powershell Connector
                           </h3>
                           <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                             Onboard Active Directory using the PowerShell-based connector
                           </p>
                         </div>
                         {isStaticAdSelected && (
                           <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                             <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })()}
                 {(searchQuery === "" ||
                   "global ad config management".includes(searchQuery.toLowerCase())) && (() => {
                   const isGlobalAdConfigSelected =
                     formData.step1.type === "Global AD config management" &&
                     !formData.step1.aiAgentOnboard;
                   return (
                     <div
                       key="static-global-ad-config-management"
                       onClick={() =>
                         toggleStep1ApplicationType("Global AD config management", false)
                       }
                       className={`p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                         isGlobalAdConfigSelected
                           ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                           : "border-gray-200 bg-white hover:border-gray-300"
                       }`}
                     >
                       <div className="flex items-start gap-2.5">
                         <div
                           className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                           aria-hidden
                         >
                           <AppTypeCardIcon typeId="Global AD config management" />
                         </div>
                         <div className="min-w-0 flex-1">
                           <h3 className="font-medium text-gray-900 text-sm leading-snug">
                             Global AD config management
                           </h3>
                           <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                             Centralized management of global Active Directory configuration settings
                           </p>
                         </div>
                         {isGlobalAdConfigSelected && (
                           <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                             <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })()}
                 {applicationTypes.length === 0 ? (
                   <div className="col-span-full text-center text-gray-500 p-4">
                     No application types available. Please check the API connection.
                   </div>
                 ) : (
                   applicationTypes
                     .flatMap((type) => {
                       const cards: Array<{
                         type: ApplicationTypeOption;
                         aiAgentOnboard: boolean;
                         displayTitle: string;
                         cardKey: string;
                       }> = [];

                       if (isAiAgentOnlyOnboardApplicationType(type.id)) {
                         cards.push({
                           type,
                           aiAgentOnboard: true,
                           displayTitle: `${type.title} (AI Agent)`,
                           cardKey: `${type.id}::ai-agent`,
                         });
                         return cards;
                       }

                       cards.push({
                         type,
                         aiAgentOnboard: false,
                         displayTitle: type.title,
                         cardKey: type.id,
                       });
                       if (isAiAgentOnboardApplicationType(type.id)) {
                         cards.push({
                           type,
                           aiAgentOnboard: true,
                           displayTitle: `${type.title} (AI Agent)`,
                           cardKey: `${type.id}::ai-agent`,
                         });
                       }
                       return cards;
                     })
                     .filter(({ displayTitle, type }) =>
                       searchQuery === "" ||
                       displayTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       type.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       type.id.toLowerCase().includes(searchQuery.toLowerCase())
                     )
                     .map(({ type, aiAgentOnboard, displayTitle, cardKey }) => {
                       const isSelected =
                         formData.step1.type === type.id &&
                         formData.step1.aiAgentOnboard === aiAgentOnboard;
                       return (
                   <div
                     key={cardKey}
                     onClick={() => toggleStep1ApplicationType(type.id, aiAgentOnboard)}
                     className={`p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                       isSelected
                         ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                         : "border-gray-200 bg-white hover:border-gray-300"
                     }`}
                   >
                     <div className="flex items-start gap-2.5">
                       <div
                         className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                         aria-hidden
                       >
                         <AppTypeCardIcon typeId={type.id} />
                       </div>
                       <div className="min-w-0 flex-1">
                         <h3 className="font-medium text-gray-900 text-sm leading-snug">{displayTitle}</h3>
                         <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{type.subtitle}</p>
                         {type.advancedSettingParts && (
                           <div className="mt-2 pt-2 border-t border-slate-200/90 grid grid-cols-3 gap-1.5">
                             {(
                               [
                                 { key: "hook" as const, label: "Hook" },
                                 { key: "threshold" as const, label: "Threshold" },
                                 { key: "autoRetry" as const, label: "Auto retry" },
                               ] as const
                             ).map(({ key, label }) => (
                               <div
                                 key={key}
                                 className="rounded-md border border-slate-200/90 bg-slate-50/90 px-1 py-1.5 text-center"
                               >
                                 <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 leading-tight">
                                   {label}
                                 </div>
                                 <div className="text-[10px] text-slate-700 mt-0.5 leading-snug line-clamp-2">
                                   {describeAdvancedSettingSlotValue(type.advancedSettingParts[key])}
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                       {isSelected && (
                         <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                           <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                         </div>
                       )}
                     </div>
                   </div>
                       );
                     })
                 )}
               </div>
               )}
          </div>
        );

      case 2:
        const step1TypeLabel = formData.step1.type
          ? formData.step1.aiAgentOnboard && isAiAgentOnboardApplicationType(formData.step1.type)
            ? `${formData.step1.type} (AI Agent)`
            : formData.step1.type
          : "Not selected";
        return (
          <div className="space-y-6">
            {/* Connector strip: what was picked in Step 1, with a way back */}
            <div className="flex items-center gap-3 p-3 border border-blue-100 rounded-xl bg-blue-50">
              <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-white border border-blue-100">
                <AppTypeCardIcon typeId={formData.step1.type || ""} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 truncate">{step1TypeLabel}</div>
                <div className="text-xs text-gray-500 truncate">Selected in Step 1</div>
              </div>
              <button
                type="button"
                onClick={handlePrevious}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0"
              >
                <Edit className="w-3.5 h-3.5" aria-hidden />
                Change
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative min-w-0">
                <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={formData.step2.applicationName}
                  onChange={(e) => handleInputChange("step2", "applicationName", e.target.value)}
                  className="w-full pl-10 pr-9 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                  formData.step2.applicationName
                    ? 'top-0.5 text-xs text-blue-600'
                    : 'top-3.5 text-sm text-gray-500'
                }`}>
                  Application Name *
                </label>
                {formData.step2.applicationName.trim() && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" aria-hidden />
                )}
              </div>
              <div className="relative min-w-0">
                <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" aria-hidden />
                <select
                  id="applicationSourceType"
                  value={formData.step2.sourceType}
                  onChange={(e) =>
                    handleInputChange("step2", "sourceType", e.target.value)
                  }
                  className="w-full pl-10 pr-9 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  <option value="" disabled>
                    {" "}
                  </option>
                  {APPLICATION_SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                  aria-hidden
                />
                <label
                  htmlFor="applicationSourceType"
                  className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                    formData.step2.sourceType
                      ? "top-0.5 text-xs text-blue-600"
                      : "top-3.5 text-sm text-gray-500"
                  }`}
                >
                  Source type *
                </label>
              </div>
            </div>
            <div className="relative">
              <FileText className="absolute left-3.5 top-5 w-4 h-4 text-amber-500 pointer-events-none" aria-hidden />
              <textarea
                value={formData.step2.description}
                onChange={(e) => handleInputChange("step2", "description", e.target.value)}
                className="w-full pl-10 pr-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline resize-none"
                rows={3}
                placeholder=" "
              />
              <label className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                formData.step2.description
                  ? 'top-0.5 text-xs text-blue-600'
                  : 'top-3.5 text-sm text-gray-500'
              }`}>
                Description *
              </label>
              <div className="text-right text-xs text-gray-400 mt-1">
                {formData.step2.description.length} characters
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative" ref={technicalOwnerDropdownRef}>
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={formData.step2.technicalOwner}
                  onChange={(e) => handleOwnerInputChange("technicalOwner", e.target.value)}
                  onFocus={() => setUserSearchField("technicalOwner")}
                  className="w-full pl-10 pr-11 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                  formData.step2.technicalOwner
                    ? 'top-0.5 text-xs text-blue-600'
                    : 'top-3.5 text-sm text-gray-500'
                }`}>
                  Technical Owner *
                </label>
                {formData.step2.technicalOwnerEmail && (
                  <div
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold flex items-center justify-center"
                    title={formData.step2.technicalOwnerEmail}
                  >
                    {ownerInitials(formData.step2.technicalOwner)}
                  </div>
                )}
                {userSearchField === "technicalOwner" && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {userSearchLoading && (
                      <div className="px-4 py-3 text-sm text-gray-500">Loading users...</div>
                    )}
                    {!userSearchLoading && userSearchError && (
                      <div className="px-4 py-3 text-sm text-red-600">{userSearchError}</div>
                    )}
                    {!userSearchLoading && !userSearchError && getFilteredOwnerUsers("technicalOwner").length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
                    )}
                    {!userSearchLoading && getFilteredOwnerUsers("technicalOwner").map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleOwnerSelect("technicalOwner", user)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">{user.name || user.username}</div>
                        {user.email && <div className="text-xs text-gray-500">{user.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 relative" ref={businessOwnerDropdownRef}>
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={formData.step2.businessOwner}
                  onChange={(e) => handleOwnerInputChange("businessOwner", e.target.value)}
                  onFocus={() => setUserSearchField("businessOwner")}
                  className="w-full pl-10 pr-11 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                  formData.step2.businessOwner
                    ? 'top-0.5 text-xs text-blue-600'
                    : 'top-3.5 text-sm text-gray-500'
                }`}>
                  Business Owner *
                </label>
                {formData.step2.businessOwnerEmail && (
                  <div
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold flex items-center justify-center"
                    title={formData.step2.businessOwnerEmail}
                  >
                    {ownerInitials(formData.step2.businessOwner)}
                  </div>
                )}
                {userSearchField === "businessOwner" && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {userSearchLoading && (
                      <div className="px-4 py-3 text-sm text-gray-500">Loading users...</div>
                    )}
                    {!userSearchLoading && userSearchError && (
                      <div className="px-4 py-3 text-sm text-red-600">{userSearchError}</div>
                    )}
                    {!userSearchLoading && !userSearchError && getFilteredOwnerUsers("businessOwner").length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
                    )}
                    {!userSearchLoading && getFilteredOwnerUsers("businessOwner").map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleOwnerSelect("businessOwner", user)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">{user.name || user.username}</div>
                        {user.email && <div className="text-xs text-gray-500">{user.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        const selectedAppType = formData.step1.type;

        // For Disconnected Application (both create and edit), step 3 = Integration Settings
        if (selectedAppType === "Disconnected Application") {
          return (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                Integration Settings
              </h3>
              {renderDisconnectedApplicationFields()}
            </div>
          );
        }

        const renderIntegrationFields = () => {
          // Flatfile: step 3 is File Upload (upload button, file name, field/multivalue delimiters + Uid/Status/DateFormat/Multivalued + drag-drop fields)
          if (selectedAppType === "Flatfile") {
            const flatfileFieldsFromApi = (() => {
              const data = flatfileMetadataUsers as any;
              if (!data) return [];
              const fromParent = data?.parentFieldDefinition?.fields;
              if (Array.isArray(fromParent) && fromParent.length > 0) return fromParent;
              const preview = data?.preview;
              if (Array.isArray(preview) && preview[0] && typeof preview[0] === "object") return Object.keys(preview[0]);
              if (Array.isArray(data) && data[0] && typeof data[0] === "object") return Object.keys(data[0]);
              return [];
            })();
            const flatfileAttrOptions = flatfileFieldsFromApi.length > 0
              ? flatfileFieldsFromApi
              : ["UserID", "Username", "Email", "Status", "RoleName", "LastLogin", "DateFormat"];
            const fieldOrder: string[] = Array.isArray(formData.step3.fieldOrder) && formData.step3.fieldOrder.length > 0
              ? formData.step3.fieldOrder
              : flatfileFieldsFromApi.length > 0 ? flatfileFieldsFromApi : [];
            const multivaluedFieldList: string[] = Array.isArray(formData.step3.multivaluedField) ? formData.step3.multivaluedField : (formData.step3.multivaluedField ? [String(formData.step3.multivaluedField)] : []);

            const FIELD_DRAG_TYPE = "application/x-flatfile-field-index";
            const handleFieldDragStart = (e: React.DragEvent, index: number) => {
              e.dataTransfer.effectAllowed = "all";
              const fieldName = fieldOrder[index] ?? "";
              e.dataTransfer.setData("text/plain", fieldName);
              e.dataTransfer.setData(FIELD_DRAG_TYPE, String(index));
              e.dataTransfer.setData("text", fieldName);
            };
            const handleFieldDragOver = (e: React.DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            };
            const handleFieldDragEnter = (e: React.DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            };
            const handleFieldDropOnList = (e: React.DragEvent, dropIndex: number) => {
              e.preventDefault();
              const fromIndexStr = e.dataTransfer.getData(FIELD_DRAG_TYPE);
              if (fromIndexStr === "") return;
              const fromIndex = parseInt(fromIndexStr, 10);
              if (Number.isNaN(fromIndex) || fromIndex === dropIndex || fromIndex < 0 || fromIndex >= fieldOrder.length || dropIndex < 0 || dropIndex >= fieldOrder.length) return;
              const next = [...fieldOrder];
              const [removed] = next.splice(fromIndex, 1);
              next.splice(dropIndex, 0, removed);
              handleInputChange("step3", "fieldOrder", next);
            };
            const handleFieldDropOnInput = (e: React.DragEvent, step3Key: string) => {
              e.preventDefault();
              e.stopPropagation();
              const fieldName = (e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text") || "").trim();
              if (fieldName && (fieldOrder.includes(fieldName) || flatfileAttrOptions.includes(fieldName))) {
                handleInputChange("step3", step3Key, fieldName);
              }
            };
            const inputDragOver = (e: React.DragEvent) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
            };
            const inputDragEnter = (e: React.DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            };

            return (
              <div className="space-y-6">
                <input
                  type="file"
                  ref={flatfileFileInputRef}
                  className="hidden"
                  accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      flatfileFileRef.current = file;
                      handleInputChange("step3", "uploadedFileName", file.name);
                    }
                    e.target.value = "";
                  }}
                />
                <input
                  type="file"
                  ref={flatfilePerFieldFileInputRef}
                  className="hidden"
                  accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const forField = flatfileUploadForFieldRef.current;
                    if (file && forField) {
                      handleInputChange("step3", `uploadedFileName_${forField}`, file.name);
                      flatfileUploadForFieldRef.current = null;
                    }
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => flatfileFileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Upload
                  </button>
                  {flatfileMetadataUsers && formData.step3.uploadedFileName && (
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        readOnly
                        value={formData.step3.uploadedFileName}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-gray-50 no-underline"
                        placeholder=" "
                      />
                      <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                        File name
                      </label>
                    </div>
                  )}
                </div>
                {flatfileMetadataUsers && formData.step3.uploadedFileName && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.fieldDelimiter ?? ","}
                        onChange={(e) => handleInputChange("step3", "fieldDelimiter", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                        Field Delimiter
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.multivalueDelimiter ?? "#"}
                        onChange={(e) => handleInputChange("step3", "multivalueDelimiter", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                        Multivalue Delimiter
                      </label>
                    </div>
                  </div>
                )}
                {/* Box: Fields + Uid / Status / Date Format / Multivalued */}
                <div className="border border-gray-300 rounded-lg bg-white p-5 shadow-sm">
                  <div className="space-y-5">
                    {/* Fields: drag-and-drop list in rows */}
                    {fieldOrder.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fields</label>
                        <div className="flex flex-wrap gap-2 border border-gray-200 rounded-md p-3 bg-gray-50/50">
                          {fieldOrder.map((fieldName, index) => (
                            <div
                              key={`field-${index}-${fieldName}`}
                              draggable
                              onDragStart={(e) => handleFieldDragStart(e, index)}
                              onDragOver={handleFieldDragOver}
                              onDragEnter={handleFieldDragEnter}
                              onDrop={(e) => handleFieldDropOnList(e, index)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing text-sm text-gray-900"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                              <span>{fieldName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Row 1: Uid Attribute * | Status Field */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200">
                        <input
                          type="text"
                          readOnly
                          value={formData.step3.uidAttribute ?? ""}
                          onDragOver={inputDragOver}
                          onDragEnter={inputDragEnter}
                          onDrop={(e) => handleFieldDropOnInput(e, "uidAttribute")}
                          className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline bg-gray-50"
                          placeholder=" "
                        />
                        <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                          (formData.step3.uidAttribute ?? "")
                            ? "top-0.5 text-xs text-blue-600"
                            : "top-3.5 text-sm text-gray-500"
                        }`}>
                          Uid Attribute *
                        </label>
                        {fieldOrder.length > 0 && !(formData.step3.uidAttribute ?? "") && (
                          <span className="absolute right-3 top-3.5 text-xs text-gray-400 pointer-events-none">Drop field here</span>
                        )}
                      </div>
                      <div className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200">
                        <input
                          type="text"
                          readOnly
                          value={formData.step3.statusField ?? ""}
                          onDragOver={inputDragOver}
                          onDragEnter={inputDragEnter}
                          onDrop={(e) => handleFieldDropOnInput(e, "statusField")}
                          className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline bg-gray-50"
                          placeholder=" "
                        />
                        <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                          (formData.step3.statusField ?? "")
                            ? "top-0.5 text-xs text-blue-600"
                            : "top-3.5 text-sm text-gray-500"
                        }`}>
                          Status Field
                        </label>
                        {fieldOrder.length > 0 && !(formData.step3.statusField ?? "") && (
                          <span className="absolute right-3 top-3.5 text-xs text-gray-400 pointer-events-none">Drop field here</span>
                        )}
                      </div>
                    </div>
                    {/* Row 2: Date Format | Multivalued Field */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.step3.dateFormat ?? ""}
                          onChange={(e) => handleInputChange("step3", "dateFormat", e.target.value)}
                          className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                          placeholder=" "
                        />
                        <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                          (formData.step3.dateFormat ?? "")
                            ? "top-0.5 text-xs text-blue-600"
                            : "top-3.5 text-sm text-gray-500"
                        }`}>
                          Date Format
                        </label>
                      </div>
                      <div className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200">
                        <div
                          className="flex flex-wrap gap-2 min-h-[52px] pl-4 pt-5 pb-1.5 pr-9 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 bg-white"
                          onDragOver={inputDragOver}
                          onDragEnter={inputDragEnter}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const fieldName = (e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text") || "").trim();
                            if (fieldName && (fieldOrder.includes(fieldName) || flatfileAttrOptions.includes(fieldName)) && !multivaluedFieldList.includes(fieldName) && multivaluedFieldList.length < 3) {
                              handleInputChange("step3", "multivaluedField", [...multivaluedFieldList, fieldName]);
                            }
                          }}
                        >
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            multivaluedFieldList.length > 0
                              ? "top-0.5 text-xs text-blue-600"
                              : "top-3.5 text-sm text-gray-500"
                          }`}>
                            Multivalued Field
                          </label>
                          <span title="Please select that attribute for which multiple values are assigned to a user" className="absolute right-3 top-3.5 text-gray-500 cursor-help pointer-events-auto">
                            <Info className="w-4 h-4" />
                          </span>
                          {multivaluedFieldList.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => handleInputChange("step3", "multivaluedField", multivaluedFieldList.filter((x) => x !== item))}
                                className="p-0.5 rounded hover:bg-blue-200"
                                aria-label={`Remove ${item}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                          {fieldOrder.length > 0 && multivaluedFieldList.length === 0 && (
                            <span className="text-xs text-gray-400 self-center">Drop fields here (max 3)</span>
                          )}
                          {multivaluedFieldList.length >= 3 && (
                            <span className="text-xs text-gray-400 self-center">Maximum 3 fields</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Per–Field Name: collapsible sections (Upload, File Name, Delimiters, Field, Primary Attribute, Entitlement Type, Preview) */}
                  {multivaluedFieldList.length > 0 && (
                    <div className="pt-5 mt-5 border-t border-gray-200 space-y-3">
                      {multivaluedFieldList.map((fieldName) => {
                        const step3 = formData.step3 as Record<string, string>;
                        const isExpanded = flatfilePerFieldExpanded[fieldName] ?? false;
                        const toggleExpanded = () => setFlatfilePerFieldExpanded((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
                        const fieldLabel = fieldName.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim() + " Entity";
                        const currentValue = step3[`entitlementType_${fieldName}`] ?? "";
                        const selectedByOtherFields = multivaluedFieldList
                          .filter((f) => f !== fieldName)
                          .map((f) => step3[`entitlementType_${f}`])
                          .filter(Boolean);
                        const entitlementOptions = [
                          { value: "", label: "Select type..." },
                          { value: "Groups", label: "Groups" },
                          { value: "Roles", label: "Roles" },
                          { value: "Entitlement", label: "Entitlement" },
                        ].filter((opt) => !opt.value || opt.value === currentValue || !selectedByOtherFields.includes(opt.value));
                        const previewCollapsed = flatfilePerFieldPreviewCollapsed[fieldName] ?? true;
                        const togglePreview = () => setFlatfilePerFieldPreviewCollapsed((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
                        return (
                          <div key={fieldName} className="border border-gray-200 rounded-lg bg-gray-50/50 overflow-hidden">
                            <button
                              type="button"
                              onClick={toggleExpanded}
                              className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-gray-100/80 transition-colors"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                              )}
                              <span className="text-blue-600 font-medium">{fieldLabel}</span>
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-gray-200 space-y-4">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      flatfileUploadForFieldRef.current = fieldName;
                                      flatfilePerFieldFileInputRef.current?.click();
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shrink-0"
                                  >
                                    Upload
                                  </button>
                                  <div className="flex-1 relative min-w-0">
                                    <input
                                      type="text"
                                      readOnly
                                      value={step3[`uploadedFileName_${fieldName}`] ?? ""}
                                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-gray-50 no-underline"
                                      placeholder=" "
                                    />
                                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${step3[`uploadedFileName_${fieldName}`] ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                                      File Name
                                    </label>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={step3[`fieldDelimiter_${fieldName}`] ?? ","}
                                      onChange={(e) => handleInputChange("step3", `fieldDelimiter_${fieldName}`, e.target.value)}
                                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                      placeholder=" "
                                    />
                                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${(step3[`fieldDelimiter_${fieldName}`] ?? ",") ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                                      Field Delimiter
                                    </label>
                                  </div>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={step3[`multivalueDelimiter_${fieldName}`] ?? "#"}
                                      onChange={(e) => handleInputChange("step3", `multivalueDelimiter_${fieldName}`, e.target.value)}
                                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                      placeholder=" "
                                    />
                                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${(step3[`multivalueDelimiter_${fieldName}`] ?? "#") ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                                      Multivalue Delimiter
                                    </label>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      readOnly
                                      value={fieldName}
                                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-gray-50 no-underline"
                                      tabIndex={-1}
                                      aria-readonly
                                    />
                                    <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">Field</label>
                                  </div>
                                  <div className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200">
                                    <input
                                      type="text"
                                      readOnly
                                      value={step3[`primaryAttribute_${fieldName}`] ?? ""}
                                      onDragOver={inputDragOver}
                                      onDragEnter={inputDragEnter}
                                      onDrop={(e) => handleFieldDropOnInput(e, `primaryAttribute_${fieldName}`)}
                                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline bg-gray-50"
                                      placeholder=" "
                                    />
                                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${(step3[`primaryAttribute_${fieldName}`] ?? "") ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                                      Primary Attribute *
                                    </label>
                                    {fieldOrder.length > 0 && !(step3[`primaryAttribute_${fieldName}`] ?? "") && (
                                      <span className="absolute right-3 top-3.5 text-xs text-gray-400 pointer-events-none">Drop field here</span>
                                    )}
                                  </div>
                                </div>
                                <div className="relative">
                                  <select
                                    value={currentValue}
                                    onChange={(e) => handleInputChange("step3", `entitlementType_${fieldName}`, e.target.value)}
                                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline appearance-none bg-white text-gray-900"
                                  >
                                    {entitlementOptions.map((opt) => (
                                      <option key={opt.value || "empty"} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">Entitlement Type</label>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
                                </div>
                                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={togglePreview}
                                    className="flex items-center gap-2 px-4 py-3 w-full text-left border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    aria-expanded={!previewCollapsed}
                                  >
                                    <ChevronDown className={`w-5 h-5 text-blue-600 shrink-0 transition-transform ${previewCollapsed ? "" : "rotate-180"}`} aria-hidden />
                                    <span className="text-blue-600 font-medium">Preview</span>
                                  </button>
                                  {!previewCollapsed && (
                                    <div className="p-4 text-sm text-gray-500">
                                      {step3[`uploadedFileName_${fieldName}`] ? "Preview will appear here when supported." : "Upload a file to see preview."}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </div>
            );
          }

          // AS400 / IBM i: always use static integration fields (not API-driven)
          if (isAs400ApplicationType(selectedAppType)) {
            const readChannelRaw = (formData.step3 as any).as400ReadChannel as string | undefined;
            const readChannelVal =
              readChannelRaw === "toolbox" ? "toolbox" : readChannelRaw === "jdbc" ? "jdbc" : "";
            const writeChannelRaw = (formData.step3 as any).as400WriteChannel as string | undefined;
            const writeChannelVal =
              writeChannelRaw === "api" ? "api" : writeChannelRaw === "remote" ? "remote" : "";
            return (
              <div className="space-y-6">
                <p className="text-sm font-medium text-gray-900">
                  Integration settings <span className="text-red-500">*</span>
                </p>
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAs400ReadOperationsExpanded((e) => !e)}
                      className="flex items-center justify-between gap-3 w-full px-4 py-4 min-h-[3.5rem] text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                      aria-expanded={as400ReadOperationsExpanded}
                    >
                      <span className="text-base font-semibold text-gray-900 min-w-0 pr-2">Read Operations</span>
                      {as400ReadOperationsExpanded ? (
                        <ChevronUp className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                      )}
                    </button>
                    {as400ReadOperationsExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                    <div className="w-1/2 max-w-full mb-5">
                      <label htmlFor="as400-read-channel" className="block text-xs font-medium text-gray-600 mb-1">
                        Read channel
                      </label>
                      <div className="relative">
                        <select
                          id="as400-read-channel"
                          value={readChannelVal}
                          onChange={(e) => handleInputChange("step3", "as400ReadChannel", e.target.value)}
                          className="w-full h-9 text-sm rounded-md border border-gray-300 bg-white pl-3 pr-8 py-1.5 text-gray-900 shadow-sm appearance-none focus:outline-none focus:ring-0 focus:border-gray-400"
                        >
                          <option value="" />
                          <option value="jdbc">JDBC-Based Read Channel</option>
                          <option value="toolbox">IBM Toolbox API-Based Read Channel</option>
                        </select>
                        <ChevronDown
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                          aria-hidden
                        />
                      </div>
                    </div>
                    {readChannelVal === "jdbc" && (
                        <div className="space-y-4">
                          <div
                            className="flex flex-nowrap items-center gap-2.5 overflow-x-auto min-w-0 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]"
                            role="list"
                            aria-label="JDBC read channel capabilities"
                          >
                            {["Account aggregation", "Entitlement extraction", "Reporting"].map((label) => (
                              <span
                                key={label}
                                role="listitem"
                                className="inline-flex shrink-0 items-center px-4 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadConnectorType ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadConnectorType", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadConnectorType
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Connector Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadDriverClass ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadDriverClass", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadDriverClass
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Driver Class
                              </label>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={(formData.step3 as any).jdbcReadJdbcUrl ?? ""}
                              onChange={(e) => handleInputChange("step3", "jdbcReadJdbcUrl", e.target.value)}
                              className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                              placeholder=" "
                            />
                            <label
                              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                (formData.step3 as any).jdbcReadJdbcUrl
                                  ? "top-0.5 text-xs text-blue-600"
                                  : "top-3.5 text-sm text-gray-500"
                              }`}
                            >
                              JDBC URL
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadHost ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadHost", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadHost
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Host
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadPort ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadPort", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadPort
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Port
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadDatabaseName ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadDatabaseName", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadDatabaseName
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Database Name
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadNamingConvention ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadNamingConvention", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadNamingConvention
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Naming Convention
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadDefaultLibraries ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadDefaultLibraries", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadDefaultLibraries
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Default Libraries
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadUserId ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadUserId", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                                autoComplete="off"
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadUserId
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                User ID
                              </label>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type={jdbcReadPasswordVisible ? "text" : "password"}
                              value={(formData.step3 as any).jdbcReadPassword ?? ""}
                              onChange={(e) => handleInputChange("step3", "jdbcReadPassword", e.target.value)}
                              className="w-full pl-4 pr-11 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                              placeholder=" "
                              autoComplete="off"
                            />
                            <label
                              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                (formData.step3 as any).jdbcReadPassword
                                  ? "top-0.5 text-xs text-blue-600"
                                  : "top-3.5 text-sm text-gray-500"
                              }`}
                            >
                              Password
                            </label>
                            <button
                              type="button"
                              onClick={() => setJdbcReadPasswordVisible((v) => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label={jdbcReadPasswordVisible ? "Hide password" : "Show password"}
                            >
                              {jdbcReadPasswordVisible ? (
                                <EyeOff className="w-4 h-4" aria-hidden />
                              ) : (
                                <Eye className="w-4 h-4" aria-hidden />
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4 items-end">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).jdbcReadConnectionTimeout ?? ""}
                                onChange={(e) => handleInputChange("step3", "jdbcReadConnectionTimeout", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).jdbcReadConnectionTimeout
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Connection Timeout
                              </label>
                            </div>
                            <div className="flex items-center gap-2 pb-2 sm:pb-1.5">
                              <input
                                type="checkbox"
                                id="jdbcReadSslEnabled"
                                checked={Boolean((formData.step3 as any).jdbcReadSslEnabled)}
                                onChange={(e) => handleInputChange("step3", "jdbcReadSslEnabled", e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="jdbcReadSslEnabled" className="text-sm font-medium text-gray-700 cursor-pointer">
                                SSL Enabled
                              </label>
                            </div>
                          </div>
                        </div>
                    )}
                    {readChannelVal === "toolbox" && (
                        <div className="space-y-4">
                          <div
                            className="flex flex-nowrap items-center gap-2.5 overflow-x-auto min-w-0 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]"
                            role="list"
                            aria-label="IBM Toolbox read channel capabilities"
                          >
                            {[
                              "Real-time reads",
                              "Deep system-level attributes",
                              "When SQL services are insufficient",
                              "Legacy environments",
                            ].map((label) => (
                              <span
                                key={label}
                                role="listitem"
                                className="inline-flex shrink-0 items-center px-4 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).ibmToolboxConnectorType ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxConnectorType", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxConnectorType
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Connector Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).ibmToolboxHost ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxHost", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxHost
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Host
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).ibmToolboxUserId ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxUserId", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                                autoComplete="off"
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxUserId
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                User ID
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type={ibmToolboxPasswordVisible ? "text" : "password"}
                                value={(formData.step3 as any).ibmToolboxPassword ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxPassword", e.target.value)}
                                className="w-full pl-4 pr-11 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                                autoComplete="off"
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxPassword
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Password
                              </label>
                              <button
                                type="button"
                                onClick={() => setIbmToolboxPasswordVisible((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label={ibmToolboxPasswordVisible ? "Hide password" : "Show password"}
                              >
                                {ibmToolboxPasswordVisible ? (
                                  <EyeOff className="w-4 h-4" aria-hidden />
                                ) : (
                                  <Eye className="w-4 h-4" aria-hidden />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).ibmToolboxPort ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxPort", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxPort
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Port
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).ibmToolboxTransportProtocol ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxTransportProtocol", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxTransportProtocol
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Transport Protocol
                              </label>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={(formData.step3 as any).ibmToolboxCcsid ?? ""}
                              onChange={(e) => handleInputChange("step3", "ibmToolboxCcsid", e.target.value)}
                              className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                              placeholder=" "
                            />
                            <label
                              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                (formData.step3 as any).ibmToolboxCcsid
                                  ? "top-0.5 text-xs text-blue-600"
                                  : "top-3.5 text-sm text-gray-500"
                              }`}
                            >
                              CCSID
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-4 items-end">
                            <div className="flex items-center gap-2 pb-2 sm:pb-1.5">
                              <input
                                type="checkbox"
                                id="ibmToolboxUseSsl"
                                checked={Boolean((formData.step3 as any).ibmToolboxUseSsl)}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxUseSsl", e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="ibmToolboxUseSsl" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Use SSL
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).ibmToolboxSocketTimeout ?? ""}
                                onChange={(e) => handleInputChange("step3", "ibmToolboxSocketTimeout", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).ibmToolboxSocketTimeout
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Socket Timeout
                              </label>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={(formData.step3 as any).ibmToolboxRetryCount ?? ""}
                              onChange={(e) => handleInputChange("step3", "ibmToolboxRetryCount", e.target.value)}
                              className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                              placeholder=" "
                            />
                            <label
                              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                (formData.step3 as any).ibmToolboxRetryCount
                                  ? "top-0.5 text-xs text-blue-600"
                                  : "top-3.5 text-sm text-gray-500"
                              }`}
                            >
                              Retry Count
                            </label>
                          </div>
                        </div>
                    )}
                    </div>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAs400WriteOperationsExpanded((e) => !e)}
                      className="flex items-center justify-between gap-3 w-full px-4 py-4 min-h-[3.5rem] text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                      aria-expanded={as400WriteOperationsExpanded}
                    >
                      <span className="text-base font-semibold text-gray-900 min-w-0 pr-2">Write Operations</span>
                      {as400WriteOperationsExpanded ? (
                        <ChevronUp className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                      )}
                    </button>
                    {as400WriteOperationsExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                    <div className="w-1/2 max-w-full mb-5">
                      <label htmlFor="as400-write-channel" className="block text-xs font-medium text-gray-600 mb-1">
                        Write channel
                      </label>
                      <div className="relative">
                        <select
                          id="as400-write-channel"
                          value={writeChannelVal}
                          onChange={(e) => handleInputChange("step3", "as400WriteChannel", e.target.value)}
                          className="w-full h-9 text-sm rounded-md border border-gray-300 bg-white pl-3 pr-8 py-1.5 text-gray-900 shadow-sm appearance-none focus:outline-none focus:ring-0 focus:border-gray-400"
                        >
                          <option value="" />
                          <option value="remote">Write via Remote Command</option>
                          <option value="api">Write via API / Program Call</option>
                        </select>
                        <ChevronDown
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                          aria-hidden
                        />
                      </div>
                    </div>
                    {writeChannelVal === "remote" && (
                        <div className="space-y-4">
                          <div
                            className="flex flex-nowrap items-center gap-2.5 overflow-x-auto min-w-0 pb-0.5 [scrollbar-width:thin]"
                            role="list"
                            aria-label="Remote command operations"
                          >
                            {["CRTUSRPRF", "CHGUSRPRF", "DLTUSRPRF"].map((label) => (
                              <span
                                key={label}
                                role="listitem"
                                className="inline-flex shrink-0 items-center px-4 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemoteChannelType ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemoteChannelType", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemoteChannelType
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Write Channel Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemoteConnectorLabel ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemoteConnectorLabel", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemoteConnectorLabel
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Connector Label
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemoteHostName ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemoteHostName", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemoteHostName
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Host Name
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemotePort ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemotePort", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemotePort
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Port
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemoteServiceType ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemoteServiceType", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemoteServiceType
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Service Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemoteTransportProtocol ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemoteTransportProtocol", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemoteTransportProtocol
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Transport Protocol
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 items-end">
                            <div className="flex items-center gap-2 pb-2 sm:pb-1.5">
                              <input
                                type="checkbox"
                                id="writeRemoteUseSsl"
                                checked={Boolean((formData.step3 as any).writeRemoteUseSsl)}
                                onChange={(e) => handleInputChange("step3", "writeRemoteUseSsl", e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="writeRemoteUseSsl" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Use SSL
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeRemoteUserId ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeRemoteUserId", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                                autoComplete="off"
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeRemoteUserId
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                User ID
                              </label>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={(formData.step3 as any).writeRemotePasswordReference ?? ""}
                              onChange={(e) => handleInputChange("step3", "writeRemotePasswordReference", e.target.value)}
                              className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                              placeholder=" "
                              autoComplete="off"
                            />
                            <label
                              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                (formData.step3 as any).writeRemotePasswordReference
                                  ? "top-0.5 text-xs text-blue-600"
                                  : "top-3.5 text-sm text-gray-500"
                              }`}
                            >
                              Password Reference
                            </label>
                          </div>
                        </div>
                    )}
                    {writeChannelVal === "api" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiChannelType ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiChannelType", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiChannelType
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Write Channel Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiConnectorLabel ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiConnectorLabel", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiConnectorLabel
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Connector Label
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiHostName ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiHostName", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiHostName
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Host Name
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiPort ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiPort", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiPort
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Port
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiServiceType ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiServiceType", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiServiceType
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Service Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiTransportProtocol ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiTransportProtocol", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiTransportProtocol
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                Transport Protocol
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 items-end">
                            <div className="flex items-center gap-2 pb-2 sm:pb-1.5">
                              <input
                                type="checkbox"
                                id="writeApiUseSsl"
                                checked={Boolean((formData.step3 as any).writeApiUseSsl)}
                                onChange={(e) => handleInputChange("step3", "writeApiUseSsl", e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="writeApiUseSsl" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Use SSL
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={(formData.step3 as any).writeApiUserId ?? ""}
                                onChange={(e) => handleInputChange("step3", "writeApiUserId", e.target.value)}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                placeholder=" "
                                autoComplete="off"
                              />
                              <label
                                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                  (formData.step3 as any).writeApiUserId
                                    ? "top-0.5 text-xs text-blue-600"
                                    : "top-3.5 text-sm text-gray-500"
                                }`}
                              >
                                User ID
                              </label>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={(formData.step3 as any).writeApiPasswordReference ?? ""}
                              onChange={(e) => handleInputChange("step3", "writeApiPasswordReference", e.target.value)}
                              className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                              placeholder=" "
                              autoComplete="off"
                            />
                            <label
                              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                (formData.step3 as any).writeApiPasswordReference
                                  ? "top-0.5 text-xs text-blue-600"
                                  : "top-3.5 text-sm text-gray-500"
                              }`}
                            >
                              Password Reference
                            </label>
                          </div>
                        </div>
                    )}
                    </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Active Directory Powershell Connector: dedicated static field layout (not API-driven),
          // must be handled before the dynamic/custom-fields block below or a filled-in field
          // (e.g. agentPool) would get treated as a "custom field" and hijack the render.
          if (selectedAppType === "Active Directory Powershell Connector") {
            return (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                  PowerShell Connector Settings
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.step3.domainName || ""}
                      onChange={(e) => handleInputChange("step3", "domainName", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.domainName
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Domain Name *
                    </label>
                  </div>
                  <div className="flex-1 relative" ref={agentPoolDropdownRef}>
                    <input
                      type="text"
                      readOnly
                      value={
                        AD_POWERSHELL_AGENT_POOL_OPTIONS.find(
                          (o) => o.value === formData.step3.agentPool
                        )?.label || ""
                      }
                      onClick={() => setIsAgentPoolDropdownOpen((open) => !open)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline cursor-pointer"
                      placeholder=" "
                    />
                    <ChevronDown
                      className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none transition-transform ${
                        isAgentPoolDropdownOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                    <label
                      className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.agentPool
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}
                    >
                      Agent Pool *
                    </label>
                    {isAgentPoolDropdownOpen && (
                      <div
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-y-auto"
                        style={{ maxHeight: "16rem" }}
                      >
                        {(() => {
                          let lastGroupLabel: string | null | undefined = undefined;
                          return AD_POWERSHELL_AGENT_POOL_OPTIONS.map((option) => {
                            const showGroupHeader =
                              option.groupLabel !== null && option.groupLabel !== lastGroupLabel;
                            lastGroupLabel = option.groupLabel;
                            return (
                              <div key={option.value}>
                                {showGroupHeader && (
                                  <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50">
                                    {option.groupLabel}
                                  </div>
                                )}
                                <div
                                  className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                  onClick={() => {
                                    handleInputChange("step3", "agentPool", option.value);
                                    setIsAgentPoolDropdownOpen(false);
                                  }}
                                >
                                  {option.label}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.step3.scriptBundleVersion || ""}
                    onChange={(e) => handleInputChange("step3", "scriptBundleVersion", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.scriptBundleVersion
                      ? 'top-0.5 text-xs text-blue-600'
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Script Bundle Version (blank = current)
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  No credentials are configured here. The agent runs as a gMSA and PowerShell inherits
                  its token, so scripts authenticate to the domain over integrated Kerberos. Agent
                  pools are listed from registered agents — a pool is normally two agents at one site,
                  so work continues if one is unavailable.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3 pt-2">
                  Optional Overrides
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.step3.defaultUserOu || ""}
                      onChange={(e) => handleInputChange("step3", "defaultUserOu", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.defaultUserOu
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Default User Ou
                    </label>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.step3.contactOu || ""}
                      onChange={(e) => handleInputChange("step3", "contactOu", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.contactOu
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Contact Ou
                    </label>
                  </div>
                </div>
              </div>
            );
          }

          // Active Directory Domain: dedicated static field layout (not API-driven), same reasoning
          // as the PowerShell connector above — must run before the dynamic/custom-fields block.
          if (selectedAppType === "Active Directory Domain") {
            return (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                  Active Directory Domain Settings
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.step3.hostname || ""}
                      onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.hostname
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Hostname *
                    </label>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.step3.username || ""}
                      onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.username
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      UserName *
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="password"
                      value={formData.step3.password || ""}
                      onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.password
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Password *
                    </label>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.step3.domain || ""}
                      onChange={(e) => handleInputChange("step3", "domain", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.domain
                        ? 'top-0.5 text-xs text-blue-600'
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Domain *
                    </label>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.step3.backupHostname || ""}
                    onChange={(e) => handleInputChange("step3", "backupHostname", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.backupHostname
                      ? 'top-0.5 text-xs text-blue-600'
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Backup Hostname
                  </label>
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAdDomainVaultSettingsExpanded((e) => !e)}
                    className="flex items-center justify-between gap-3 w-full px-4 py-4 min-h-[3.5rem] text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                    aria-expanded={adDomainVaultSettingsExpanded}
                  >
                    <span className="text-base font-semibold text-gray-900 min-w-0 pr-2">Advanced</span>
                    {adDomainVaultSettingsExpanded ? (
                      <ChevronUp className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                    )}
                  </button>
                  {adDomainVaultSettingsExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.primaryDomainController ?? ""}
                        onChange={(e) => handleInputChange("step3", "primaryDomainController", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.primaryDomainController
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Domain Controller *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <select
                        value={formData.step3.portSsl ?? ""}
                        onChange={(e) => handleInputChange("step3", "portSsl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline appearance-none bg-white"
                      >
                        <option value=""></option>
                        <option value="389 - LDAP">389 - LDAP</option>
                        <option value="636 - LDAPS">636 - LDAPS</option>
                      </select>
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.portSsl
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port / SSL
                      </label>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <select
                        value={formData.step3.vault ?? ""}
                        onChange={(e) => handleInputChange("step3", "vault", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline appearance-none bg-white"
                      >
                        <option value=""></option>
                        <option value="DPW-Dubai-CyberArk">DPW-Dubai-CyberArk</option>
                        <option value="US-AD-OCI-Vault">US-AD-OCI-Vault</option>
                        <option value="NA-Shared-CyberArk">NA-Shared-CyberArk</option>
                        <option value="UK-HashiCorp-Vault">UK-HashiCorp-Vault</option>
                      </select>
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.vault
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Vault *
                      </label>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.secretPath ?? ""}
                        onChange={(e) => handleInputChange("step3", "secretPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.secretPath
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Secret Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userSearchBase ?? ""}
                        onChange={(e) => handleInputChange("step3", "userSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userSearchBase
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Search Base
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSearchBase ?? ""}
                        onChange={(e) => handleInputChange("step3", "groupSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSearchBase
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Search Base
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deletedOu ?? ""}
                        onChange={(e) => handleInputChange("step3", "deletedOu", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deletedOu
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Deleted OU
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.contactOu ?? ""}
                        onChange={(e) => handleInputChange("step3", "contactOu", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.contactOu
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Contact OU
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.vaultName || ""}
                        onChange={(e) => handleInputChange("step3", "vaultName", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.vaultName
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Vault Name
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.vaultPath || ""}
                        onChange={(e) => handleInputChange("step3", "vaultPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.vaultPath
                          ? 'top-0.5 text-xs text-blue-600'
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Vault Path
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-900">Inherited Global Policies</h4>
                        {[
                          { label: "Email uniqueness", border: "border-blue-300", text: "text-blue-600", bg: "bg-blue-50" },
                          { label: "SAMaccount", border: "border-purple-300", text: "text-purple-600", bg: "bg-purple-50" },
                          { label: "UPN", border: "border-emerald-300", text: "text-emerald-600", bg: "bg-emerald-50" },
                        ].map(({ label, border, text, bg }) => (
                          <span
                            key={label}
                            title="Inherited from global validations — cannot be edited here"
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border cursor-not-allowed ${border} ${text} ${bg}`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setInheritedPoliciesEditing((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          inheritedPoliciesEditing
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {inheritedPoliciesEditing ? (
                          <>
                            <Check className="w-3.5 h-3.5" aria-hidden />
                            Save
                          </>
                        ) : (
                          <>
                            <Edit className="w-3.5 h-3.5" aria-hidden />
                            Edit
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <span className="text-sm text-gray-600">Port</span>
                        <input
                          type="text"
                          value={formData.step3.inheritedPort ?? "636"}
                          onChange={(e) => handleInputChange("step3", "inheritedPort", e.target.value)}
                          disabled={!inheritedPoliciesEditing}
                          className={`w-20 text-right text-sm font-semibold rounded-md px-2 py-1 focus:outline-none ${
                            inheritedPoliciesEditing
                              ? "text-gray-900 bg-white border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              : "text-gray-900 bg-transparent border border-transparent cursor-not-allowed"
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <span className="text-sm text-gray-600">SSL enabled</span>
                        <ToggleSwitch
                          checked={formData.step3.inheritedSslEnabled ?? true}
                          onChange={(v) => handleInputChange("step3", "inheritedSslEnabled", v)}
                          disabled={!inheritedPoliciesEditing}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <span className="text-sm text-gray-600">Delete account on delete request</span>
                        <ToggleSwitch
                          checked={formData.step3.inheritedDeleteAcctOnDeleteRequest ?? false}
                          onChange={(v) => handleInputChange("step3", "inheritedDeleteAcctOnDeleteRequest", v)}
                          disabled={!inheritedPoliciesEditing}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <span className="text-sm text-gray-600">Revoke membership</span>
                        <ToggleSwitch
                          checked={formData.step3.inheritedRevokeMembership ?? true}
                          onChange={(v) => handleInputChange("step3", "inheritedRevokeMembership", v)}
                          disabled={!inheritedPoliciesEditing}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 col-span-2">
                        <span className="text-sm text-gray-600">Primary Identity Attribute</span>
                        <input
                          type="text"
                          value={formData.step3.inheritedPrimaryIdentityAttribute ?? "samaccountname"}
                          onChange={(e) => handleInputChange("step3", "inheritedPrimaryIdentityAttribute", e.target.value)}
                          disabled={!inheritedPoliciesEditing}
                          className={`w-48 text-right text-sm font-semibold rounded-md px-2 py-1 focus:outline-none ${
                            inheritedPoliciesEditing
                              ? "text-gray-900 bg-white border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              : "text-gray-900 bg-transparent border border-transparent cursor-not-allowed"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  </div>
                  )}
                </div>
              </div>
            );
          }

          // Dynamic rendering based on API-provided fields + custom fields from step3/connectionDetails
          const integrationGroupsForType = applicationTypeIntegrationGroups[selectedAppType] ?? [];
          const typeFields = applicationTypeFields[selectedAppType] || [];
          const selectedOauth = formData.step1.oauthType;
          const oauthFieldsForType = oauthTypeFields[selectedOauth] || [];
          const allKnownFields = new Set<string>([
            ...typeFields,
            ...oauthFieldsForType,
            ...integrationGroupsForType.flatMap((g) => g.fields),
          ]);
          const customFieldKeys = Object.keys(formData.step3 || {}).filter(
            (k) => typeof k === "string" && k.trim() !== "" && !allKnownFields.has(k)
          );

          if (
            typeFields.length > 0 ||
            oauthFieldsForType.length > 0 ||
            customFieldKeys.length > 0 ||
            integrationGroupsForType.length > 0
          ) {
            const renderField = (fieldKey: unknown) => {
              const key = coerceSupportedObjectsFieldKey(fieldKey);
              if (!key) return null;
              const label = formatIntegrationFieldLabel(key);
              const value = (formData.step3 as any)[key] ?? "";
              const isPasswordLike = /password|secret|token|passphrase/i.test(key);
              return (
                <div className="flex-1 relative min-w-0" key={key}>
                  <input
                    type={isPasswordLike ? "password" : "text"}
                    value={value}
                    onChange={(e) => handleInputChange("step3", key, e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                    autoComplete={isPasswordLike ? "off" : undefined}
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    value ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                  }`}>
                    {label}
                  </label>
                </div>
              );
            };

            if (
              isAiAgentWizard &&
              isGroupedOnboardApplicationType(selectedAppType) &&
              (integrationGroupsForType.length > 0 || selectedAppType === "ScreenScrapping")
            ) {
              const connGroup = integrationGroupsForType.find(
                (g) => g.id === CONNECTION_PARAMETERS_GROUP_ID
              );
              const integrationValues = Object.fromEntries(
                integrationGroupsForType.flatMap((g) =>
                  g.fields.map((fk) => [fk, String((formData.step3 as Record<string, unknown>)[fk] ?? "")])
                )
              );
              const canTestConnection =
                selectedAppType === "Database"
                  ? isDatabaseTestConnectionPayloadComplete(
                      buildDatabaseTestConnectionPayload(
                        formData.step3 as Record<string, unknown>
                      )
                    )
                  : connGroup
                    ? connGroup.fields.every((fk) => getStep3Trim(fk) !== "")
                    : false;
              const getAllUsersValue = pickViewGetAllUsersFromStep3(
                formData.step3 as Record<string, unknown>
              );
              const screenScrappingBaseUrlValue = pickScreenScrappingBaseUrlFromStep3(
                formData.step3 as Record<string, unknown>
              );
              const screenScrappingJsonFileName = String(
                formData.step3.screenScrapingJsonFileName ?? ""
              );
              const showReconciliationSection =
                (selectedAppType === "Database" && isDatabaseConnectionTestSuccessful()) ||
                isRestLikeGroupedOnboardApplicationType(selectedAppType);
              const isScreenScrappingAiAgentType = selectedAppType === "ScreenScrapping";
              const loadSchemaBlocked =
                fetchSchemaLoading ||
                (isScreenScrappingAiAgentType
                  ? !isScreenScrappingIntegrationInputComplete(
                      formData.step3 as Record<string, unknown>
                    )
                  : !getAllUsersValue ||
                    (selectedAppType === "Database" &&
                      !databaseSessionId &&
                      !getStep3Trim("dbSessionId")));

              const getAllUsersField = showReconciliationSection ? (
                <div className="relative w-full">
                  <input
                    type="text"
                    value={getAllUsersValue}
                    onChange={(e) =>
                      handleInputChange("step3", VIEW_GET_ALL_USERS_FIELD, e.target.value)
                    }
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder=" "
                    required
                  />
                  <label
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      getAllUsersValue
                        ? "top-0.5 text-xs text-blue-600"
                        : "top-3.5 text-sm text-gray-500"
                    }`}
                  >
                    {isRestLikeGroupedOnboardApplicationType(selectedAppType)
                      ? "Get All Users URL *"
                      : "Get All Users *"}
                  </label>
                </div>
              ) : null;

              const loadSchemaSection = showReconciliationSection ? (
                <div className="space-y-3">
                  {(databaseSessionId || getStep3Trim("dbSessionId")) && (
                    <p className="text-xs text-slate-500 font-mono truncate">
                      Session: {databaseSessionId || getStep3Trim("dbSessionId")}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      {fetchSchemaFeedback ? (
                        <p
                          className={`text-sm ${
                            fetchSchemaFeedback.type === "success"
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                          role="status"
                        >
                          {fetchSchemaFeedback.message}
                        </p>
                      ) : databaseSchemaLoaded ? (
                        <p className="text-sm text-green-700" role="status">
                          Schema loaded ({attributeMappingData.length} columns). Schema Mapping step
                          is unlocked.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Load schema to unlock the next step.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchDatabaseSchema}
                      disabled={loadSchemaBlocked}
                      className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${
                        loadSchemaBlocked
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {fetchSchemaLoading ? "Loading schema…" : "Load Schema"}
                    </button>
                  </div>
                </div>
              ) : null;

              const reconciliationSection = showReconciliationSection ? (
                <div className="border border-slate-200 rounded-lg bg-white shadow-sm p-4 sm:p-5 space-y-4">
                  {getAllUsersField}
                  {loadSchemaSection}
                </div>
              ) : null;

              const isRestServiceAiAgentType = selectedAppType === "RESTService Application";

              const screenScrappingBaseUrlField = showReconciliationSection ? (
                <div className="relative w-full">
                  <input
                    type="text"
                    value={screenScrappingBaseUrlValue}
                    onChange={(e) =>
                      handleInputChange("step3", SCREEN_SCRAPPING_BASE_URL_FIELD, e.target.value)
                    }
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder=" "
                    required
                  />
                  <label
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      screenScrappingBaseUrlValue
                        ? "top-0.5 text-xs text-blue-600"
                        : "top-3.5 text-sm text-gray-500"
                    }`}
                  >
                    baseURL *
                  </label>
                </div>
              ) : null;

              const screenScrappingJsonUploadField = showReconciliationSection ? (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={screenScrappingJsonFileInputRef}
                    className="hidden"
                    accept=".json,application/json,text/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleScreenScrappingJsonUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={() => screenScrappingJsonFileInputRef.current?.click()}
                      className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                    >
                      {screenScrappingJsonFileName ? "Change JSON" : "Upload JSON"}
                    </button>
                    {screenScrappingJsonFileName ? (
                      <>
                        <div className="flex-1 relative min-w-0">
                          <input
                            type="text"
                            readOnly
                            value={screenScrappingJsonFileName}
                            onClick={() => screenScrappingJsonFileInputRef.current?.click()}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                            placeholder=" "
                            title="Click to choose a different JSON file"
                          />
                          <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                            JSON file *
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearScreenScrappingJsonFile}
                          className="shrink-0 p-2 border border-gray-300 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                          title="Remove uploaded file"
                          aria-label="Remove uploaded file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Only .json files are accepted.</p>
                    )}
                  </div>
                </div>
              ) : null;

              const screenScrappingIntegrationCard = showReconciliationSection ? (
                <div className="border border-slate-200 rounded-lg bg-white shadow-sm p-4 sm:p-5 space-y-4">
                  {screenScrappingBaseUrlField}
                  {screenScrappingJsonUploadField}
                  {loadSchemaSection}
                </div>
              ) : null;

              const restLikeIntegrationCard = showReconciliationSection ? (
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-5 border-b border-slate-200/80 bg-slate-50/40">
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">Get All Users</h4>
                    <p className="text-xs text-slate-500 mb-4">
                      Enter the URL that returns all users.
                    </p>
                    {getAllUsersField}
                  </div>
                  <div className="px-5 py-5 border-b border-slate-200/80">
                    <h4 className="text-sm font-semibold text-slate-800 mb-4">
                      {connGroup?.label ?? "Connection Parameters"}
                    </h4>
                    <TabbedIntegrationOnboardGroups
                      applicationType={selectedAppType}
                      groups={integrationGroupsForType}
                      values={integrationValues}
                      onChange={(key, value) => handleInputChange("step3", key, value)}
                      activeTabId={groupedIntegrationTab}
                      onActiveTabChange={setGroupedIntegrationTab}
                      bare
                      hideIntro
                    />
                  </div>
                  <div className="px-5 py-5">
                    <h4 className="text-sm font-semibold text-slate-800 mb-4">Load Schema</h4>
                    {loadSchemaSection}
                  </div>
                </div>
              ) : null;

              return (
                <div className="space-y-6 w-full overflow-visible">
                  {isScreenScrappingAiAgentType ? (
                    screenScrappingIntegrationCard
                  ) : isRestServiceAiAgentType ? (
                    restLikeIntegrationCard
                  ) : (
                    <>
                      <TabbedIntegrationOnboardGroups
                        applicationType={selectedAppType}
                        groups={integrationGroupsForType}
                        values={integrationValues}
                        onChange={(key, value) => handleInputChange("step3", key, value)}
                        activeTabId={groupedIntegrationTab}
                        onActiveTabChange={setGroupedIntegrationTab}
                        testConnectionLoading={testConnectionLoading}
                        testConnectionFeedback={testConnectionFeedback}
                        onTestConnection={handleTestConnection}
                        canTestConnection={canTestConnection}
                      />
                      {reconciliationSection}
                    </>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {integrationGroupsForType.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      Advanced settings (grouped)
                    </div>
                    <div className="flex flex-col gap-3">
                      {integrationGroupsForType.map((group) => {
                        const expandKey = `${selectedAppType}::${group.id}`;
                        const expanded = integrationGroupExpanded[expandKey] ?? false;
                        return (
                          <div
                            key={group.id}
                            className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setIntegrationGroupExpanded((prev) => ({
                                  ...prev,
                                  [expandKey]: !(prev[expandKey] ?? false),
                                }))
                              }
                              className={`flex w-full items-center justify-between gap-3 px-5 py-4 min-h-[3.25rem] text-left bg-slate-50/90 hover:bg-slate-100/80 transition-colors ${
                                expanded ? "border-b border-slate-200/80" : ""
                              }`}
                              aria-expanded={expanded}
                            >
                              <span className="text-base font-semibold text-slate-800 min-w-0">
                                {group.label}
                              </span>
                              {expanded ? (
                                <ChevronUp className="w-5 h-5 text-slate-600 shrink-0" aria-hidden />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-600 shrink-0" aria-hidden />
                              )}
                            </button>
                            {expanded && (
                              isAdvancedIntegrationGroupId(group.id) ? (
                                <div className="px-5 pb-5 pt-4 bg-white">
                                  <AdvancedIntegrationOperationTabs
                                    fieldKeys={filterIntegrationFieldsForApplicationType(
                                      selectedAppType,
                                      group.fields
                                    )}
                                    renderFields={(keys) => (
                                      <div className="grid grid-cols-2 gap-4">
                                        {keys.map((fk) => renderField(fk))}
                                      </div>
                                    )}
                                  />
                                </div>
                              ) : (
                              <div className="px-5 pb-5 pt-4 grid grid-cols-2 gap-4 bg-white">
                                {filterIntegrationFieldsForApplicationType(
                                  selectedAppType,
                                  group.fields
                                ).map((fk) => renderField(fk))}
                              </div>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {typeFields.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">{selectedAppType} Settings</div>
                    <div className="grid grid-cols-2 gap-4">
                      {filterIntegrationFieldsForApplicationType(selectedAppType, typeFields).map(
                        (f) => renderField(f)
                      )}
                    </div>
                  </div>
                )}
                {oauthFieldsForType.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">{selectedOauth} OAuth Settings</div>
                    <div className="grid grid-cols-2 gap-4">
                      {oauthFieldsForType.map((f) => renderField(f))}
                    </div>
                  </div>
                )}
                {customFieldKeys.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">Custom fields</div>
                    <div className="grid grid-cols-2 gap-4">
                      {customFieldKeys.map((f) => renderField(f))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Fallback to existing hardcoded layouts if API did not return fields for the selected type
          switch (selectedAppType) {
            case "LDAP":
            case "Generic LDAP":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "userSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Search Base *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "groupSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Search Base *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Active Directory":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.useSSL || ""}
                        onChange={(e) => handleInputChange("step3", "useSSL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.useSSL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Use SSL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.domain || ""}
                        onChange={(e) => handleInputChange("step3", "domain", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.domain
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Domain *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "userSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Search Base *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "groupSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Search Base *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Database":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.databaseType || ""}
                        onChange={(e) => handleInputChange("step3", "databaseType", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.databaseType
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Database Type *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.connectionURL || ""}
                        onChange={(e) => handleInputChange("step3", "connectionURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.connectionURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Connection URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.viewGetAllUsers || ""}
                        onChange={(e) => handleInputChange("step3", "viewGetAllUsers", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.viewGetAllUsers
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        View Get All Users *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.viewGetAllGroups || ""}
                        onChange={(e) => handleInputChange("step3", "viewGetAllGroups", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.viewGetAllGroups
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        View Get All Groups *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.viewGetAllRoleContents || ""}
                        onChange={(e) => handleInputChange("step3", "viewGetAllRoleContents", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.viewGetAllRoleContents
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        View Get All Role Contents *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.viewGetUser || ""}
                        onChange={(e) => handleInputChange("step3", "viewGetUser", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.viewGetUser
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        View Get User *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.viewGetGroup || ""}
                        onChange={(e) => handleInputChange("step3", "viewGetGroup", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.viewGetGroup
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        View Get Group *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.viewGetRoleContent || ""}
                        onChange={(e) => handleInputChange("step3", "viewGetRoleContent", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.viewGetRoleContent
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        View Get Role Content *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.uniqueIDSchemaMap || ""}
                        onChange={(e) => handleInputChange("step3", "uniqueIDSchemaMap", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.uniqueIDSchemaMap
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Unique ID Schema Map *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spRevokeGroupMembership || ""}
                        onChange={(e) => handleInputChange("step3", "spRevokeGroupMembership", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spRevokeGroupMembership
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Revoke Group Membership *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.revokeGroupMembershipDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "revokeGroupMembershipDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.revokeGroupMembershipDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Revoke Group Membership Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.revokeGroupMembershipResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "revokeGroupMembershipResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.revokeGroupMembershipResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Revoke Group Membership Response Definition *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spAddGroupMembership || ""}
                        onChange={(e) => handleInputChange("step3", "spAddGroupMembership", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spAddGroupMembership
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Add Group Membership *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.addGroupMembershipDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "addGroupMembershipDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.addGroupMembershipDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Add Group Membership Definition *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.addGroupMembershipResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "addGroupMembershipResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.addGroupMembershipResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Add Group Membership Response Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSchemaMap || ""}
                        onChange={(e) => handleInputChange("step3", "groupSchemaMap", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSchemaMap
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Schema Map *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.roleContentSchemaMap || ""}
                        onChange={(e) => handleInputChange("step3", "roleContentSchemaMap", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.roleContentSchemaMap
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Role Content Schema Map *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spCreateAccount || ""}
                        onChange={(e) => handleInputChange("step3", "spCreateAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spCreateAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Create Account *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.createAccountDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "createAccountDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.createAccountDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Create Account Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.createAccountResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "createAccountResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.createAccountResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Create Account Response Definition *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spUpdateAccount || ""}
                        onChange={(e) => handleInputChange("step3", "spUpdateAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spUpdateAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Update Account *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.updateAccountDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "updateAccountDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.updateAccountDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Update Account Definition *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.updateAccountResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "updateAccountResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.updateAccountResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Update Account Response Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spDeleteAccount || ""}
                        onChange={(e) => handleInputChange("step3", "spDeleteAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spDeleteAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Delete Account *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteAccountDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "deleteAccountDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteAccountDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete Account Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteAccountResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "deleteAccountResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteAccountResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete Account Response Definition *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spEnableAccount || ""}
                        onChange={(e) => handleInputChange("step3", "spEnableAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spEnableAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Enable Account *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.enableAccountDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "enableAccountDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.enableAccountDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Enable Account Definition *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.enableAccountResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "enableAccountResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.enableAccountResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Enable Account Response Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.spDisableAccount || ""}
                        onChange={(e) => handleInputChange("step3", "spDisableAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.spDisableAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        SP Disable Account *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.disableAccountDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "disableAccountDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.disableAccountDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Disable Account Definition *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.disableAccountResponseDefinition || ""}
                        onChange={(e) => handleInputChange("step3", "disableAccountResponseDefinition", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.disableAccountResponseDefinition
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Disable Account Response Definition *
                      </label>
                    </div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              );

            case "Database Collector":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.collector || ""}
                        onChange={(e) => handleInputChange("step3", "collector", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.collector
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Collector *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Database User Management":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Disconnected Application":
              return (
                <div className="text-sm text-gray-600">
                  Integration settings for disconnected applications are configured in the
                  &nbsp;
                  <span className="font-medium">Add Details</span> step.
                </div>
              );

            case "E2EMigration Client":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.validFrom || ""}
                        onChange={(e) => handleInputChange("step3", "validFrom", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.validFrom
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Valid From *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.validUpto || ""}
                        onChange={(e) => handleInputChange("step3", "validUpto", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.validUpto
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Valid Upto *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.validityToken || ""}
                        onChange={(e) => handleInputChange("step3", "validityToken", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.validityToken
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Validity Token *
                      </label>
                    </div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              );

            case "Epic":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Generic LDAP":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "userSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Search Base *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "groupSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Search Base *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "LDAP":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.serviceId || ""}
                        onChange={(e) => handleInputChange("step3", "serviceId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.serviceId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Service Id *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "userSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Search Base *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "groupSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Search Base *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "AWS":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.accessID || ""}
                        onChange={(e) => handleInputChange("step3", "accessID", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.accessID
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Access ID *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.accessSecret || ""}
                        onChange={(e) => handleInputChange("step3", "accessSecret", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.accessSecret
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Access Secret *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Logical Application":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.applicationId || ""}
                        onChange={(e) => handleInputChange("step3", "applicationId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.applicationId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Application Id *
                      </label>
                    </div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              );

            case "LogicalApp Active Directory":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.useSSL || ""}
                        onChange={(e) => handleInputChange("step3", "useSSL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.useSSL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Use SSL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.domain || ""}
                        onChange={(e) => handleInputChange("step3", "domain", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.domain
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Domain *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "userSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Search Base *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupSearchBase || ""}
                        onChange={(e) => handleInputChange("step3", "groupSearchBase", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupSearchBase
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Search Base *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupScope || ""}
                        onChange={(e) => handleInputChange("step3", "groupScope", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupScope
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Scope *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userScope || ""}
                        onChange={(e) => handleInputChange("step3", "userScope", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userScope
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Scope *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultGroupOfNewAccount || ""}
                        onChange={(e) => handleInputChange("step3", "defaultGroupOfNewAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultGroupOfNewAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Group Of New Account *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteAccountOnDeleteRequest || ""}
                        onChange={(e) => handleInputChange("step3", "deleteAccountOnDeleteRequest", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteAccountOnDeleteRequest
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete Account On Delete Request *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.revokeMembershipOnDeleteRequest || ""}
                        onChange={(e) => handleInputChange("step3", "revokeMembershipOnDeleteRequest", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.revokeMembershipOnDeleteRequest
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Revoke Membership On Delete Request *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.primaryIdentityAttribute || ""}
                        onChange={(e) => handleInputChange("step3", "primaryIdentityAttribute", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.primaryIdentityAttribute
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Primary Identity Attribute *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "OKTA":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.apiKey || ""}
                        onChange={(e) => handleInputChange("step3", "apiKey", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.apiKey
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        API Key *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostURL || ""}
                        onChange={(e) => handleInputChange("step3", "hostURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Host URL *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "OIMOUD Management":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.restServiceURL || ""}
                        onChange={(e) => handleInputChange("step3", "restServiceURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.restServiceURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        RESTService URL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.t3ServiceHostname || ""}
                        onChange={(e) => handleInputChange("step3", "t3ServiceHostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.t3ServiceHostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        T3Service Hostname *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.t3ServicePort || ""}
                        onChange={(e) => handleInputChange("step3", "t3ServicePort", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.t3ServicePort
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        T3Service Port *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.t3ServiceAuthloginConfigFile || ""}
                        onChange={(e) => handleInputChange("step3", "t3ServiceAuthloginConfigFile", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.t3ServiceAuthloginConfigFile
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        T3Service Authlogin Config File *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.tenantId || ""}
                        onChange={(e) => handleInputChange("step3", "tenantId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.tenantId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Tenant Id *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.oudServiceAccountId || ""}
                        onChange={(e) => handleInputChange("step3", "oudServiceAccountId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.oudServiceAccountId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        OUDService Account Id *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.oudServiceAccountPWD || ""}
                        onChange={(e) => handleInputChange("step3", "oudServiceAccountPWD", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.oudServiceAccountPWD
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        OUDService Account PWD *
                      </label>
                    </div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              );

            case "Oracle E-Business":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Oracle IDCS":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.clientId || ""}
                        onChange={(e) => handleInputChange("step3", "clientId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client ID *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.clientSecret || ""}
                        onChange={(e) => handleInputChange("step3", "clientSecret", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientSecret
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client Secret *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.endpointURL || ""}
                        onChange={(e) => handleInputChange("step3", "endpointURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.endpointURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Endpoint URL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.enableAutoRetry || ""}
                        onChange={(e) => handleInputChange("step3", "enableAutoRetry", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.enableAutoRetry
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Enable Auto Retry *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.autoRetryInterval || ""}
                        onChange={(e) => handleInputChange("step3", "autoRetryInterval", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.autoRetryInterval
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Auto Retry Interval *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.step3.maximumAutoRetry || ""}
                        onChange={(e) => handleInputChange("step3", "maximumAutoRetry", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.maximumAutoRetry
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Maximum Auto Retry *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Oracle Identity Manager":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.applicationServerType || ""}
                        onChange={(e) => handleInputChange("step3", "applicationServerType", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.applicationServerType
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Application Server Type *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.namingProviderUrl || ""}
                        onChange={(e) => handleInputChange("step3", "namingProviderUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.namingProviderUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Naming Provider Url *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.authLoginConfigPath || ""}
                        onChange={(e) => handleInputChange("step3", "authLoginConfigPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.authLoginConfigPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Auth Login Config Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.dbSchema || ""}
                        onChange={(e) => handleInputChange("step3", "dbSchema", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.dbSchema
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Db Schema *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "OracleFusionApps":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.endpoint || ""}
                        onChange={(e) => handleInputChange("step3", "endpoint", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.endpoint
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Endpoint *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              );

            case "PeopleSoft":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "PeopleSoftHR":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "PeopleSoftUM":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.serviceURL || ""}
                        onChange={(e) => handleInputChange("step3", "serviceURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.serviceURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Service URL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.host || ""}
                        onChange={(e) => handleInputChange("step3", "host", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.host
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Host *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.senderNode || ""}
                        onChange={(e) => handleInputChange("step3", "senderNode", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.senderNode
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Sender Node *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.receiverNode || ""}
                        onChange={(e) => handleInputChange("step3", "receiverNode", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.receiverNode
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Receiver Node *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.createUserOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "createUserOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.createUserOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Create User Operation Method *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.updateUserOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "updateUserOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.updateUserOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Update User Operation Method *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteUserOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "deleteUserOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteUserOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete User Operation Method *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getUserOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "getUserOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getUserOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get User Operation Method *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getAllUsersOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "getAllUsersOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getAllUsersOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get All Users Operation Method *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.createGroupOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "createGroupOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.createGroupOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Create Group Operation Method *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteGroupOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "deleteGroupOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteGroupOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete Group Operation Method *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getGroupOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "getGroupOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getGroupOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get Group Operation Method *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getAllGroupsOperationMethod || ""}
                        onChange={(e) => handleInputChange("step3", "getAllGroupsOperationMethod", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getAllGroupsOperationMethod
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get All Groups Operation Method *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultRole || ""}
                        onChange={(e) => handleInputChange("step3", "defaultRole", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultRole
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Role *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultPrimaryPermission || ""}
                        onChange={(e) => handleInputChange("step3", "defaultPrimaryPermission", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultPrimaryPermission
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Primary Permission *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultNavigatorPermission || ""}
                        onChange={(e) => handleInputChange("step3", "defaultNavigatorPermission", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultNavigatorPermission
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Navigator Permission *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultRowSecurityPermission || ""}
                        onChange={(e) => handleInputChange("step3", "defaultRowSecurityPermission", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultRowSecurityPermission
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Row Security Permission *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultProcessProfilePermission || ""}
                        onChange={(e) => handleInputChange("step3", "defaultProcessProfilePermission", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultProcessProfilePermission
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Process Profile Permission *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Provisioning Agent":
              return (
                <div className="space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.applicationId || ""}
                      onChange={(e) => handleInputChange("step3", "applicationId", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.applicationId
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Application ID *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.applicationHooks || ""}
                      onChange={(e) => handleInputChange("step3", "applicationHooks", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.applicationHooks
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Application Hooks *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.isEnabled || ""}
                      onChange={(e) => handleInputChange("step3", "isEnabled", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.isEnabled
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Is Enabled *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.enableAutoRetry || ""}
                      onChange={(e) => handleInputChange("step3", "enableAutoRetry", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.enableAutoRetry
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Enable Auto Retry *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.autoRetryInterval || ""}
                      onChange={(e) => handleInputChange("step3", "autoRetryInterval", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.autoRetryInterval
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Auto Retry Interval *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.maximumAutoRetry || ""}
                      onChange={(e) => handleInputChange("step3", "maximumAutoRetry", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.maximumAutoRetry
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Maximum Auto Retry *
                    </label>
                  </div>
                </div>
              );

            case "RSA":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.adminId || ""}
                        onChange={(e) => handleInputChange("step3", "adminId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.adminId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Admin ID *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.adminPassword || ""}
                        onChange={(e) => handleInputChange("step3", "adminPassword", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.adminPassword
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Admin Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "SAP":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "SailPointIIQApplications":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.baseUri || ""}
                        onChange={(e) => handleInputChange("step3", "baseUri", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.baseUri
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Base URI *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.step3.password || ""}
                      onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.password
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Password *
                    </label>
                  </div>
                </div>
              );

            case "SailPointIdentityIQ":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.hostname || ""}
                        onChange={(e) => handleInputChange("step3", "hostname", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.hostname
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Hostname *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.port || ""}
                        onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.port
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Port *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.baseUri || ""}
                        onChange={(e) => handleInputChange("step3", "baseUri", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.baseUri
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Base URI *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.step3.password || ""}
                      onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.password
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Password *
                    </label>
                  </div>
                </div>
              );

            case "SalesForce":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.clientId || ""}
                        onChange={(e) => handleInputChange("step3", "clientId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client Id *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.clientSecret || ""}
                        onChange={(e) => handleInputChange("step3", "clientSecret", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientSecret
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client Secret *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.endpoint || ""}
                        onChange={(e) => handleInputChange("step3", "endpoint", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.endpoint
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Endpoint *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.securityToken || ""}
                        onChange={(e) => handleInputChange("step3", "securityToken", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.securityToken
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Security Token *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Service Now Ticketing":
              return (
                <div className="space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.tenantUrl || ""}
                      onChange={(e) => handleInputChange("step3", "tenantUrl", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.tenantUrl
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Tenant URL *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.baseUri || ""}
                      onChange={(e) => handleInputChange("step3", "baseUri", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.baseUri
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Base URI *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.username || ""}
                      onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.username
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Username *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.step3.password || ""}
                      onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.password
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Password *
                    </label>
                  </div>
                </div>
              );

            case "Unix":
              return (
                <div className="space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.connectionType || ""}
                      onChange={(e) => handleInputChange("step3", "connectionType", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.connectionType
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Connection Type *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.host || ""}
                      onChange={(e) => handleInputChange("step3", "host", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.host
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Host *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.port || ""}
                      onChange={(e) => handleInputChange("step3", "port", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.port
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Port *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.username || ""}
                      onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.username
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Username *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.step3.password || ""}
                      onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.password
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Password *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.step3.passphrase || ""}
                      onChange={(e) => handleInputChange("step3", "passphrase", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.passphrase
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Passphrase *
                    </label>
                  </div>
                </div>
              );

            case "RESTService Application":
              return (
                <div className="space-y-6">
                  {/* Service Endpoints/Operations */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getUserService || ""}
                        onChange={(e) => handleInputChange("step3", "getUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get User Service *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getAllUserService || ""}
                        onChange={(e) => handleInputChange("step3", "getAllUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getAllUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get All User Service *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getGroupService || ""}
                        onChange={(e) => handleInputChange("step3", "getGroupService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getGroupService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get Group Service *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getAllGroupsService || ""}
                        onChange={(e) => handleInputChange("step3", "getAllGroupsService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getAllGroupsService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get All Groups Service *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.assignAccessToUserService || ""}
                        onChange={(e) => handleInputChange("step3", "assignAccessToUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.assignAccessToUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Assign Access To User Service *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.revokeAccessFromUserService || ""}
                        onChange={(e) => handleInputChange("step3", "revokeAccessFromUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.revokeAccessFromUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Revoke Access From User Service *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.revokeAccessFromGroupService || ""}
                        onChange={(e) => handleInputChange("step3", "revokeAccessFromGroupService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.revokeAccessFromGroupService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Revoke Access From Group Service *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteUserService || ""}
                        onChange={(e) => handleInputChange("step3", "deleteUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete User Service *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.createUserService || ""}
                        onChange={(e) => handleInputChange("step3", "createUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.createUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Create User Service *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.updateUserService || ""}
                        onChange={(e) => handleInputChange("step3", "updateUserService", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.updateUserService
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Update User Service *
                      </label>
                    </div>
                  </div>

                  {/* Authentication & Authorization */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.authorizationType || ""}
                        onChange={(e) => handleInputChange("step3", "authorizationType", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.authorizationType
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Authorization Type *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.authorizationURL || ""}
                        onChange={(e) => handleInputChange("step3", "authorizationURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.authorizationURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Authorization URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.grantType || ""}
                        onChange={(e) => handleInputChange("step3", "grantType", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.grantType
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Grant Type *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.scope || ""}
                        onChange={(e) => handleInputChange("step3", "scope", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.scope
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Scope *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.authUserName || ""}
                        onChange={(e) => handleInputChange("step3", "authUserName", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.authUserName
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Auth User Name *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.bearerToken || ""}
                        onChange={(e) => handleInputChange("step3", "bearerToken", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.bearerToken
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Bearer Token *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.clientId || ""}
                        onChange={(e) => handleInputChange("step3", "clientId", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientId
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client ID *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.clientSecret || ""}
                        onChange={(e) => handleInputChange("step3", "clientSecret", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientSecret
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client Secret *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.refreshToken || ""}
                        onChange={(e) => handleInputChange("step3", "refreshToken", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.refreshToken
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Refresh Token *
                      </label>
                    </div>
                  </div>

                  {/* Header & Payload Configuration */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.headerAttributes || ""}
                        onChange={(e) => handleInputChange("step3", "headerAttributes", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.headerAttributes
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Header Attributes *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersPayloadPath || ""}
                        onChange={(e) => handleInputChange("step3", "usersPayloadPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersPayloadPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Payload Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupsPayloadPath || ""}
                        onChange={(e) => handleInputChange("step3", "groupsPayloadPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupsPayloadPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Groups Payload Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.createUserPayloadPath || ""}
                        onChange={(e) => handleInputChange("step3", "createUserPayloadPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.createUserPayloadPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Create User Payload Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.updateUserPayloadPath || ""}
                        onChange={(e) => handleInputChange("step3", "updateUserPayloadPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.updateUserPayloadPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Update User Payload Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getUserPayloadPath || ""}
                        onChange={(e) => handleInputChange("step3", "getUserPayloadPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getUserPayloadPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get User Payload Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.getGroupPayloadPath || ""}
                        onChange={(e) => handleInputChange("step3", "getGroupPayloadPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.getGroupPayloadPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Get Group Payload Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersGroupIdAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersGroupIdAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersGroupIdAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Group ID Attribute Path *
                      </label>
                    </div>
                  </div>

                  {/* Attribute & Mapping Paths */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersGroupIdadAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersGroupIdadAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersGroupIdadAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Group IDAD Attribute Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersGroupDisplayAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersGroupDisplayAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersGroupDisplayAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Group Display Attribute Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersOnDemandIdAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersOnDemandIdAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersOnDemandIdAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users OnDemand ID Attribute Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersOnDemandIdadAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersOnDemandIdadAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersOnDemandIdadAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users OnDemand IDAD Attribute Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersOnDemandIdadAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersOnDemandIdadAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersOnDemandIdadAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users OnDemand IDAD Attribute Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersOnDemandDisplayAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersOnDemandDisplayAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersOnDemandDisplayAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users OnDemand Display Attribute Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersRoleIdAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersRoleIdAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersRoleIdAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Role ID Attribute Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersRoleIdadAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersRoleIdadAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersRoleIdadAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Role IDAD Attribute Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.usersRoleDisplayAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "usersRoleDisplayAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.usersRoleDisplayAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Users Role Display Attribute Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupMembersAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "groupMembersAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupMembersAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Members Attribute Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupMembersIdadAttributePath || ""}
                        onChange={(e) => handleInputChange("step3", "groupMembersIdadAttributePath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupMembersIdadAttributePath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Members IDAD Attribute Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userIdadAttribute || ""}
                        onChange={(e) => handleInputChange("step3", "userIdadAttribute", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userIdadAttribute
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User IDAD Attribute *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupIdadAttribute || ""}
                        onChange={(e) => handleInputChange("step3", "groupIdadAttribute", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupIdadAttribute
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group IDAD Attribute *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupDisplayNameAttribute || ""}
                        onChange={(e) => handleInputChange("step3", "groupDisplayNameAttribute", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupDisplayNameAttribute
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Display Name Attribute *
                      </label>
                    </div>
                  </div>

                  {/* Total Results Configuration */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.totalResultsHdPerUsersPath || ""}
                        onChange={(e) => handleInputChange("step3", "totalResultsHdPerUsersPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.totalResultsHdPerUsersPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Total Results HD Per Users Path *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.totalResultsHdPerGroupsPath || ""}
                        onChange={(e) => handleInputChange("step3", "totalResultsHdPerGroupsPath", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.totalResultsHdPerGroupsPath
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Total Results HD Per Groups Path *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.totalResultsAttributePerUsers || ""}
                        onChange={(e) => handleInputChange("step3", "totalResultsAttributePerUsers", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.totalResultsAttributePerUsers
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Total Results Attribute Per Users *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.totalResultsAttributePerGroups || ""}
                        onChange={(e) => handleInputChange("step3", "totalResultsAttributePerGroups", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.totalResultsAttributePerGroups
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Total Results Attribute Per Groups *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Active Directory Collector":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.collector || ""}
                        onChange={(e) => handleInputChange("step3", "collector", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.collector
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Collector *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.groupScope || ""}
                        onChange={(e) => handleInputChange("step3", "groupScope", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.groupScope
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Group Scope *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.userScope || ""}
                        onChange={(e) => handleInputChange("step3", "userScope", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.userScope
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        User Scope *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.defaultGroupOfNewAccount || ""}
                        onChange={(e) => handleInputChange("step3", "defaultGroupOfNewAccount", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.defaultGroupOfNewAccount
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Default Group Of New Account *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.deleteAccountOnDeleteRequest || ""}
                        onChange={(e) => handleInputChange("step3", "deleteAccountOnDeleteRequest", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.deleteAccountOnDeleteRequest
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Delete Account On Delete Request *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.revokeMembershipOnDeleteRequest || ""}
                        onChange={(e) => handleInputChange("step3", "revokeMembershipOnDeleteRequest", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.revokeMembershipOnDeleteRequest
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Revoke Membership On Delete Request *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.primaryIdentityAttribute || ""}
                        onChange={(e) => handleInputChange("step3", "primaryIdentityAttribute", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.primaryIdentityAttribute
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Primary Identity Attribute *
                      </label>
                    </div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              );

            case "Azure":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.tenantURL || ""}
                        onChange={(e) => handleInputChange("step3", "tenantURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.tenantURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Tenant URL *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.operationalURL || ""}
                        onChange={(e) => handleInputChange("step3", "operationalURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.operationalURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Operational URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.tenantID || ""}
                        onChange={(e) => handleInputChange("step3", "tenantID", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.tenantID
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Tenant ID *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.clientID || ""}
                        onChange={(e) => handleInputChange("step3", "clientID", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientID
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client ID *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.clientSecret || ""}
                        onChange={(e) => handleInputChange("step3", "clientSecret", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.clientSecret
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Client Secret *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.trustedSource || ""}
                        onChange={(e) => handleInputChange("step3", "trustedSource", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.trustedSource
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Trusted Source *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "Centrify":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.tenantID || ""}
                        onChange={(e) => handleInputChange("step3", "tenantID", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.tenantID
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Tenant ID *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.tenantURL || ""}
                        onChange={(e) => handleInputChange("step3", "tenantURL", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.tenantURL
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Tenant URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            case "ATG Web Commerce":
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.driver || ""}
                        onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.driver
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Driver *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.jdbcUrl || ""}
                        onChange={(e) => handleInputChange("step3", "jdbcUrl", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.jdbcUrl
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        JDBC URL *
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.step3.username || ""}
                        onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.username
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Username *
                      </label>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="password"
                        value={formData.step3.password || ""}
                        onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step3.password
                          ? 'top-0.5 text-xs text-blue-600' 
                          : 'top-3.5 text-sm text-gray-500'
                      }`}>
                        Password *
                      </label>
                    </div>
                  </div>
                </div>
              );

            default:
              return (
                <div className="space-y-6">
                  <p className="text-gray-500 text-center py-8">
                    Please select an application type in Step 1 to see integration settings
                  </p>
                </div>
              );
          }
        };

        const getFieldDescriptions = () => {
          switch (selectedAppType) {
            case "LDAP":
            case "Generic LDAP":
              return {
                hostname: "The hostname or IP address of the LDAP server",
                port: "The port number for LDAP connection (usually 389 or 636)",
                username: "Username for LDAP authentication",
                password: "Password for LDAP authentication",
                userSearchBase: "Base DN for searching users in the directory",
                groupSearchBase: "Base DN for searching groups in the directory"
              };
            case "Active Directory":
              return {
                hostname: "The hostname or IP address of the Active Directory server",
                port: "The port number for Active Directory connection (e.g., 389, 636)",
                useSSL: "Whether to use SSL for the Active Directory connection",
                username: "Username for connecting to Active Directory",
                password: "Password for the Active Directory username",
                domain: "The domain name of the Active Directory",
                userSearchBase: "Base DN for searching users in the directory",
                groupSearchBase: "Base DN for searching groups in the directory"
              };
            case "Active Directory Collector":
              return {
                collector: "The collector configuration for Active Directory",
                groupScope: "Scope for group collection in Active Directory",
                userScope: "Scope for user collection in Active Directory",
                defaultGroupOfNewAccount: "Default group assignment for new accounts",
                deleteAccountOnDeleteRequest: "Whether to delete account when delete request is made",
                revokeMembershipOnDeleteRequest: "Whether to revoke membership when delete request is made",
                primaryIdentityAttribute: "Primary attribute used for identity in Active Directory"
              };
            case "Database":
              return {
                databaseType: "Type of database (MySQL, PostgreSQL, Oracle, etc.)",
                connectionURL: "JDBC connection URL for the database",
                driver: "JDBC driver class name for database connection",
                username: "Database username for authentication",
                password: "Database password for authentication",
                viewGetAllUsers: "Database view or stored procedure to get all users",
                viewGetAllGroups: "Database view or stored procedure to get all groups",
                viewGetAllRoleContents: "Database view or stored procedure to get all role contents",
                viewGetUser: "Database view or stored procedure to get a specific user",
                viewGetGroup: "Database view or stored procedure to get a specific group",
                viewGetRoleContent: "Database view or stored procedure to get role content",
                uniqueIDSchemaMap: "Schema mapping for unique identifiers",
                spRevokeGroupMembership: "Stored procedure to revoke group membership",
                revokeGroupMembershipDefinition: "Definition for revoke group membership operation",
                revokeGroupMembershipResponseDefinition: "Response definition for revoke group membership",
                spAddGroupMembership: "Stored procedure to add group membership",
                addGroupMembershipDefinition: "Definition for add group membership operation",
                addGroupMembershipResponseDefinition: "Response definition for add group membership",
                groupSchemaMap: "Schema mapping for group attributes",
                roleContentSchemaMap: "Schema mapping for role content attributes",
                spCreateAccount: "Stored procedure to create account",
                createAccountDefinition: "Definition for create account operation",
                createAccountResponseDefinition: "Response definition for create account",
                spUpdateAccount: "Stored procedure to update account",
                updateAccountDefinition: "Definition for update account operation",
                updateAccountResponseDefinition: "Response definition for update account",
                spDeleteAccount: "Stored procedure to delete account",
                deleteAccountDefinition: "Definition for delete account operation",
                deleteAccountResponseDefinition: "Response definition for delete account",
                spEnableAccount: "Stored procedure to enable account",
                enableAccountDefinition: "Definition for enable account operation",
                enableAccountResponseDefinition: "Response definition for enable account",
                spDisableAccount: "Stored procedure to disable account",
                disableAccountDefinition: "Definition for disable account operation",
                disableAccountResponseDefinition: "Response definition for disable account"
              };
            case "Database Collector":
              return {
                driver: "JDBC driver class name for database connection",
                collector: "Database collector configuration for data collection"
              };
            case "Database User Management":
              return {
                driver: "JDBC driver class name for database connection",
                jdbcUrl: "JDBC connection URL for the database",
                username: "Database username for authentication",
                password: "Database password for authentication"
              };
            case "Disconnected Application":
              return {
                applicationName: "Name of the disconnected application",
                owner: "Owner of the disconnected application",
                manuallyFulfill: "Whether to manually fulfill requests for this application",
                isIntegratedWithOIM: "Whether the application is integrated with OIM",
                raiseTicket: "Whether to raise tickets for this application",
                ticketingSystem: "Name of the ticketing system to use",
                ticketingAppId: "Application ID in the ticketing system",
                ticketingAPIToken: "API token for ticketing system authentication",
                assignTo: "Default assignee for tickets",
                oimAPIToken: "API token for OIM system authentication"
              };
            case "E2EMigration Client":
              return {
                validFrom: "Start date/time for validity period",
                validUpto: "End date/time for validity period",
                validityToken: "Token for validating end-to-end migration client"
              };
            case "Epic":
              return {
                driver: "JDBC driver class name for Epic database connection",
                jdbcUrl: "JDBC connection URL for Epic database",
                username: "Database username for Epic authentication",
                password: "Database password for Epic authentication"
              };
            case "Flatfile":
              return {
                uploadedFileName: "Name of the uploaded flat file",
                fieldDelimiter: "Character used to separate fields (e.g. comma)",
                multivalueDelimiter: "Character used to separate multiple values within a field (e.g. #)",
                uidAttribute: "Required attribute that uniquely identifies each user (e.g. UserID)",
                statusField: "Attribute that indicates user or account status",
                dateFormat: "Format string for date fields in the file (e.g. yyyy-MM-dd)",
                multivaluedField: "Attributes that can contain multiple values (e.g. roles, groups)",
                fieldOrder: "Order of fields from the file; drag and drop to reorder",
                flatfileFieldName: "Name of the multivalued field being configured",
                entitlementType: "Type of entitlement: Groups, Roles, or Entitlement"
              };
            case "LDAP":
              return {
                hostname: "The hostname or IP address of the LDAP server",
                port: "The port number for LDAP connection (usually 389 or 636)",
                serviceId: "Service ID for LDAP authentication",
                password: "Password for LDAP authentication",
                userSearchBase: "Base DN for searching users in the directory",
                groupSearchBase: "Base DN for searching groups in the directory"
              };
            case "Generic LDAP":
              return {
                hostname: "The hostname or IP address of the LDAP server",
                port: "The port number for LDAP connection (usually 389 or 636)",
                username: "Username for LDAP authentication",
                password: "Password for LDAP authentication",
                userSearchBase: "Base DN for searching users in the directory",
                groupSearchBase: "Base DN for searching groups in the directory"
              };
            case "AWS":
              return {
                accessID: "AWS Access Key ID for authentication",
                accessSecret: "AWS Secret Access Key for authentication"
              };
            case "Logical Application":
              return {
                applicationId: "Application ID for the logical application"
              };
            case "LogicalApp Active Directory":
              return {
                hostname: "The hostname or IP address of the Active Directory server",
                port: "The port number for Active Directory connection (e.g., 389, 636)",
                useSSL: "Whether to use SSL for the Active Directory connection",
                username: "Username for connecting to Active Directory",
                password: "Password for the Active Directory username",
                domain: "The domain name of the Active Directory",
                userSearchBase: "Base DN for searching users in the directory",
                groupSearchBase: "Base DN for searching groups in the directory",
                groupScope: "Scope for group collection in Active Directory",
                userScope: "Scope for user collection in Active Directory",
                defaultGroupOfNewAccount: "Default group assignment for new accounts",
                deleteAccountOnDeleteRequest: "Whether to delete account when delete request is made",
                revokeMembershipOnDeleteRequest: "Whether to revoke membership when delete request is made",
                primaryIdentityAttribute: "Primary attribute used for identity in Active Directory"
              };
            case "OKTA":
              return {
                apiKey: "OKTA API key for authentication",
                hostURL: "OKTA organization URL"
              };
            case "OIMOUD Management":
              return {
                restServiceURL: "REST service URL for OIMOUD management",
                t3ServiceHostname: "T3 service hostname for OIMOUD connection",
                t3ServicePort: "T3 service port number for OIMOUD connection",
                t3ServiceAuthloginConfigFile: "T3 service authentication login configuration file path",
                username: "Username for OIMOUD authentication",
                password: "Password for OIMOUD authentication",
                tenantId: "Tenant ID for OIMOUD management",
                oudServiceAccountId: "OUD service account ID for authentication",
                oudServiceAccountPWD: "OUD service account password for authentication"
              };
            case "Oracle E-Business":
              return {
                driver: "JDBC driver class name for Oracle E-Business database connection",
                username: "Database username for Oracle E-Business authentication",
                jdbcUrl: "JDBC connection URL for Oracle E-Business database",
                password: "Database password for Oracle E-Business authentication"
              };
            case "Oracle IDCS":
              return {
                clientId: "Oracle IDCS client ID for application authentication",
                clientSecret: "Oracle IDCS client secret for secure authentication",
                endpointURL: "Oracle IDCS endpoint URL for API access",
                username: "Username for Oracle IDCS authentication",
                password: "Password for Oracle IDCS authentication",
                enableAutoRetry: "Enable automatic retry for failed operations",
                autoRetryInterval: "Interval in seconds between automatic retry attempts",
                maximumAutoRetry: "Maximum number of automatic retry attempts"
              };
            case "Oracle Identity Manager":
              return {
                applicationServerType: "Type of application server for Oracle Identity Manager",
                namingProviderUrl: "Naming provider URL for Oracle Identity Manager connection",
                authLoginConfigPath: "Authentication login configuration file path",
                username: "Username for Oracle Identity Manager authentication",
                password: "Password for Oracle Identity Manager authentication",
                dbSchema: "Database schema for Oracle Identity Manager"
              };
            case "OracleFusionApps":
              return {
                endpoint: "Oracle Fusion Applications endpoint URL for API access",
                username: "Username for Oracle Fusion Applications authentication",
                password: "Password for Oracle Fusion Applications authentication"
              };
            case "PeopleSoft":
              return {
                driver: "JDBC driver class name for PeopleSoft database connection",
                jdbcUrl: "JDBC connection URL for PeopleSoft database",
                username: "Database username for PeopleSoft authentication",
                password: "Database password for PeopleSoft authentication"
              };
            case "PeopleSoftHR":
              return {
                driver: "JDBC driver class name for PeopleSoft HR database connection",
                jdbcUrl: "JDBC connection URL for PeopleSoft HR database",
                username: "Database username for PeopleSoft HR authentication",
                password: "Database password for PeopleSoft HR authentication"
              };
            case "PeopleSoftUM":
              return {
                serviceURL: "PeopleSoft User Management service URL for API access",
                host: "Host server for PeopleSoft User Management connection",
                senderNode: "Sender node identifier for PeopleSoft communication",
                receiverNode: "Receiver node identifier for PeopleSoft communication",
                createUserOperationMethod: "Method name for creating users in PeopleSoft",
                updateUserOperationMethod: "Method name for updating users in PeopleSoft",
                deleteUserOperationMethod: "Method name for deleting users in PeopleSoft",
                getUserOperationMethod: "Method name for retrieving single user from PeopleSoft",
                getAllUsersOperationMethod: "Method name for retrieving all users from PeopleSoft",
                createGroupOperationMethod: "Method name for creating groups in PeopleSoft",
                deleteGroupOperationMethod: "Method name for deleting groups in PeopleSoft",
                getGroupOperationMethod: "Method name for retrieving single group from PeopleSoft",
                getAllGroupsOperationMethod: "Method name for retrieving all groups from PeopleSoft",
                defaultRole: "Default role assigned to new users in PeopleSoft",
                defaultPrimaryPermission: "Default primary permission for new users in PeopleSoft",
                defaultNavigatorPermission: "Default navigator permission for new users in PeopleSoft",
                defaultRowSecurityPermission: "Default row security permission for new users in PeopleSoft",
                defaultProcessProfilePermission: "Default process profile permission for new users in PeopleSoft"
              };
            case "Provisioning Agent":
              return {
                applicationId: "Unique identifier for the provisioning agent application",
                applicationHooks: "Configuration hooks for the provisioning agent application",
                isEnabled: "Enable or disable status for the provisioning agent",
                enableAutoRetry: "Enable automatic retry functionality for failed operations",
                autoRetryInterval: "Time interval between automatic retry attempts",
                maximumAutoRetry: "Maximum number of automatic retry attempts allowed"
              };
            case "RSA":
              return {
                adminId: "RSA administrator ID for authentication",
                adminPassword: "RSA administrator password for authentication"
              };
            case "SAP":
              return {
                driver: "JDBC driver class name for SAP database connection",
                jdbcUrl: "JDBC connection URL for SAP database",
                username: "Database username for SAP authentication",
                password: "Database password for SAP authentication"
              };
            case "SailPointIIQApplications":
              return {
                hostname: "SailPoint IIQ server hostname for connection",
                port: "SailPoint IIQ server port number",
                baseUri: "Base URI for SailPoint IIQ API endpoints",
                username: "Username for SailPoint IIQ authentication",
                password: "Password for SailPoint IIQ authentication"
              };
            case "SailPointIdentityIQ":
              return {
                hostname: "SailPoint Identity IIQ server hostname for connection",
                port: "SailPoint Identity IIQ server port number",
                baseUri: "Base URI for SailPoint Identity IIQ API endpoints",
                username: "Username for SailPoint Identity IIQ authentication",
                password: "Password for SailPoint Identity IIQ authentication"
              };
            case "SalesForce":
              return {
                clientId: "Salesforce OAuth client ID for authentication",
                clientSecret: "Salesforce OAuth client secret for authentication",
                endpoint: "Salesforce API endpoint URL",
                username: "Salesforce username for authentication",
                password: "Salesforce password for authentication",
                securityToken: "Salesforce security token for API access"
              };
            case "Service Now Ticketing":
              return {
                tenantUrl: "ServiceNow tenant URL for ticketing system connection",
                baseUri: "ServiceNow base URI for API endpoints",
                username: "ServiceNow username for authentication",
                password: "ServiceNow password for authentication"
              };
            case "Unix":
              return {
                connectionType: "Type of connection to use (SSH, Telnet, Rlogin)",
                host: "Unix hostname or IP address for connection",
                port: "Port number for Unix connection",
                username: "Unix username for authentication",
                password: "Unix password for authentication",
                passphrase: "Passphrase for SSH key authentication"
              };
            case "RESTService Application":
              return {
                getUserService: "REST service endpoint for retrieving a single user",
                getAllUserService: "REST service endpoint for retrieving all users",
                getGroupService: "REST service endpoint for retrieving a single group",
                getAllGroupsService: "REST service endpoint for retrieving all groups",
                assignAccessToUserService: "REST service endpoint for assigning access to a user",
                revokeAccessFromUserService: "REST service endpoint for revoking access from a user",
                revokeAccessFromGroupService: "REST service endpoint for revoking access from a group",
                deleteUserService: "REST service endpoint for deleting a user",
                createUserService: "REST service endpoint for creating a user",
                updateUserService: "REST service endpoint for updating a user",
                authorizationType: "Type of authorization used for REST service authentication",
                authorizationURL: "URL for authorization endpoint",
                grantType: "OAuth grant type for authentication",
                scope: "OAuth scope for API access permissions",
                authUserName: "Username for REST service authentication",
                password: "Password for REST service authentication",
                bearerToken: "Bearer token for API authentication",
                clientId: "OAuth client ID for authentication",
                clientSecret: "OAuth client secret for authentication",
                refreshToken: "OAuth refresh token for token renewal",
                headerAttributes: "Custom header attributes for REST requests",
                usersPayloadPath: "JSON path to users data in API response",
                groupsPayloadPath: "JSON path to groups data in API response",
                createUserPayloadPath: "JSON path for user creation payload",
                updateUserPayloadPath: "JSON path for user update payload",
                getUserPayloadPath: "JSON path for user retrieval payload",
                getGroupPayloadPath: "JSON path for group retrieval payload",
                usersGroupIdAttributePath: "JSON path to group ID attribute in user data",
                usersGroupIdadAttributePath: "JSON path to group IDAD attribute in user data",
                usersGroupDisplayAttributePath: "JSON path to group display attribute in user data",
                usersOnDemandIdAttributePath: "JSON path to OnDemand ID attribute in user data",
                usersOnDemandIdadAttributePath: "JSON path to OnDemand IDAD attribute in user data",
                usersOnDemandDisplayAttributePath: "JSON path to OnDemand display attribute in user data",
                usersRoleIdAttributePath: "JSON path to role ID attribute in user data",
                usersRoleIdadAttributePath: "JSON path to role IDAD attribute in user data",
                usersRoleDisplayAttributePath: "JSON path to role display attribute in user data",
                groupMembersAttributePath: "JSON path to group members attribute",
                groupMembersIdadAttributePath: "JSON path to group members IDAD attribute",
                userIdadAttribute: "User IDAD attribute identifier",
                groupIdadAttribute: "Group IDAD attribute identifier",
                groupDisplayNameAttribute: "Group display name attribute",
                totalResultsHdPerUsersPath: "JSON path to total results header for users",
                totalResultsHdPerGroupsPath: "JSON path to total results header for groups",
                totalResultsAttributePerUsers: "Total results attribute for users pagination",
                totalResultsAttributePerGroups: "Total results attribute for groups pagination"
              };
            case "Azure":
              return {
                tenantURL: "Azure tenant URL for authentication",
                operationalURL: "Azure operational URL for operations",
                tenantID: "Azure tenant ID for identification",
                clientID: "Azure client ID for application authentication",
                clientSecret: "Azure client secret for secure authentication",
                trustedSource: "Trusted source configuration for Azure integration"
              };
            case "Centrify":
              return {
                tenantID: "Centrify tenant ID for identification",
                tenantURL: "Centrify tenant URL for authentication",
                username: "Username for Centrify authentication",
                password: "Password for Centrify authentication"
              };
            case "ATG Web Commerce":
              return {
                driver: "JDBC driver class name for database connection",
                jdbcUrl: "JDBC connection URL for ATG database",
                username: "Database username for ATG authentication",
                password: "Database password for ATG authentication"
              };
            case "AS400":
            case "AS/400":
            case "IBM AS 400":
              return {
                integrationSettings: "Whether the integration is limited to read operations or may perform write operations",
                as400ReadChannel: "Read integration path: JDBC or IBM Toolbox API",
                as400WriteChannel: "Write integration path: remote command or API/program call"
              };
            default:
              return {};
          }
        };

        const fieldDescriptions = getFieldDescriptions();
        const previewList: Record<string, unknown>[] = selectedAppType === "Flatfile" && Array.isArray((flatfileMetadataUsers as any)?.preview) ? (flatfileMetadataUsers as any).preview : [];
        const previewColumns = previewList.length > 0 && typeof previewList[0] === "object" && previewList[0] !== null ? Object.keys(previewList[0]) : [];
        const totalPreviewPages = Math.max(1, Math.ceil(previewList.length / FLATFILE_PREVIEW_PAGE_SIZE));
        const previewStartIdx = (flatfilePreviewPage - 1) * FLATFILE_PREVIEW_PAGE_SIZE;
        const previewPageRows = previewList.slice(previewStartIdx, previewStartIdx + FLATFILE_PREVIEW_PAGE_SIZE);
        const formatPreviewHeader = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();

        return (
          <div className="space-y-6 w-full">
            <div className="flex flex-wrap gap-6 items-start w-full min-w-0">
              <div className="flex-1 space-y-6 min-w-0 overflow-visible">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedAppType === "Flatfile"
                      ? "File Upload"
                      : `Integration Settings for: ${isCompleteIntegration && formData.step2.applicationName
                        ? `${formData.step2.applicationName} (${selectedAppType || "—"})`
                        : selectedAppType || "No Application Selected"}`}
                  </h3>
                  {(selectedAppType === "Flatfile" || isCompleteIntegration) && (
                    <p className="text-sm text-gray-600">
                      {selectedAppType === "Flatfile"
                        ? "Upload your flat file and set field and multivalue delimiters."
                        : "Configure the integration settings for this application."}
                    </p>
                  )}
                </div>
                {renderIntegrationFields()}
              </div>
              
              <div className="w-96 shrink-0 max-w-full bg-gray-50 rounded-lg p-6">
                <div className="space-y-4">
                  {Object.entries(fieldDescriptions).map(([field, description]) => (
                    <div key={field} className="border-b border-gray-200 pb-3 last:border-b-0">
                      <h5 className="text-sm font-medium text-gray-700 capitalize mb-1">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </h5>
                      <p className="text-xs text-gray-600">{description}</p>
                    </div>
                  ))}
                  {Object.keys(fieldDescriptions).length === 0 && (
                    <p className="text-sm text-gray-500">
                      Select an application type to see field descriptions.
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Preview table - full width below the two columns (Flatfile only), collapsible */}
            {selectedAppType === "Flatfile" && previewList.length > 0 && (
              <div className="border border-gray-300 rounded-lg bg-white overflow-hidden w-full">
                <button
                  type="button"
                  onClick={() => setFlatfilePreviewCollapsed((c) => !c)}
                  className="flex items-center gap-2 px-4 py-3 w-full text-left border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                  aria-expanded={!flatfilePreviewCollapsed}
                >
                  <ChevronDown className={`w-5 h-5 text-blue-600 shrink-0 transition-transform ${flatfilePreviewCollapsed ? "" : "rotate-180"}`} aria-hidden />
                  <span className="text-blue-600 font-medium">Preview</span>
                </button>
                {!flatfilePreviewCollapsed && (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs table-fixed border-collapse">
                    <colgroup>
                      {previewColumns.map((col) => {
                        const isEmail = col === "Email";
                        const isRootPlan = col === "RootPlan";
                        const width = isEmail ? "14%" : isRootPlan ? "18%" : undefined;
                        return <col key={col} style={width ? { width } : undefined} />;
                      })}
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        {previewColumns.map((col) => (
                          <th key={col} className="px-2 py-2.5 font-semibold text-gray-700 align-top whitespace-normal break-words">
                            {formatPreviewHeader(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewPageRows.map((row, rowIdx) => (
                        <tr key={previewStartIdx + rowIdx} className="bg-white hover:bg-gray-50">
                          {previewColumns.map((col) => (
                            <td key={col} className="px-2 py-2 text-gray-900 whitespace-normal break-words align-top leading-snug">
                              {String((row as Record<string, unknown>)[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setFlatfilePreviewPage((p) => Math.max(1, p - 1))}
                    disabled={flatfilePreviewPage <= 1}
                    className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPreviewPages }, (_, i) => i + 1)
                    .slice(0, 10)
                    .map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setFlatfilePreviewPage(pageNum)}
                        className={`min-w-[2rem] py-1.5 px-2 rounded text-sm font-medium ${
                          flatfilePreviewPage === pageNum ? "bg-blue-600 text-white" : "hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => setFlatfilePreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                    disabled={flatfilePreviewPage >= totalPreviewPages}
                    className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                </>
                )}
              </div>
            )}
          </div>
        );

      case 4:
        // For Disconnected Application (create + edit), step 4 is File Upload + preview (like Flatfile)
        if (formData.step1.type === "Disconnected Application") {
          const disconnectedPreviewList: Record<string, unknown>[] =
            disconnectedMetadataUsers && Array.isArray((disconnectedMetadataUsers as any).preview)
              ? (disconnectedMetadataUsers as any).preview
              : Array.isArray(disconnectedMetadataUsers)
                ? (disconnectedMetadataUsers as any)
                : [];
          const disconnectedPreviewColumns =
            disconnectedPreviewList.length > 0 && typeof disconnectedPreviewList[0] === "object"
              ? Object.keys(disconnectedPreviewList[0] as Record<string, unknown>)
              : [];
          const disconnectedTotalPreviewPages = Math.max(
            1,
            Math.ceil(disconnectedPreviewList.length / FLATFILE_PREVIEW_PAGE_SIZE)
          );
          const disconnectedPreviewStartIdx =
            (flatfilePreviewPage - 1) * FLATFILE_PREVIEW_PAGE_SIZE;
          const disconnectedPreviewPageRows = disconnectedPreviewList.slice(
            disconnectedPreviewStartIdx,
            disconnectedPreviewStartIdx + FLATFILE_PREVIEW_PAGE_SIZE
          );

          return (
            <div className="space-y-6">
              {!isCompleteIntegration && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                    File Upload
                  </h3>
                  <p className="text-sm text-gray-600">
                    Upload any reference or supporting file for this disconnected application.
                  </p>
                </>
              )}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setDisconnectedFile(file);
                  }}
                  className="flex-1 text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 border border-gray-300 rounded-md px-3 py-2"
                />
                <button
                  type="button"
                  disabled={disconnectedUploadLoading || !disconnectedFile}
                  onClick={async () => {
                    const file = disconnectedFile;
                    if (!file) return;
                    const appName =
                      formData.step2.applicationName?.trim() ||
                      formData.step1.applicationName?.trim() ||
                      "";
                    if (!appName) {
                      alert("Please enter Application Name before uploading.");
                      return;
                    }
                    setDisconnectedUploadLoading(true);
                    try {
                      const basicDefinition = {
                        tenantId: "ACMECOM",
                        applicationName: appName,
                        fieldDelimiter: formData.step3.fieldDelimiter ?? ",",
                        multivalueDelimiter: formData.step3.multivalueDelimiter ?? "#",
                      };
                      const data = await uploadAndGetSchemaUsers(file, basicDefinition);
                      setDisconnectedMetadataUsers(data);
                      console.debug("uploadandgetschema/users response:", data);
                    } catch (err) {
                      console.error("uploadandgetschema/users failed:", err);
                      alert(
                        err instanceof Error
                          ? err.message
                          : "Failed to upload file and fetch schema. Please try again."
                      );
                    } finally {
                      setDisconnectedUploadLoading(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                    disconnectedUploadLoading || !disconnectedFile
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {disconnectedUploadLoading ? "Uploading…" : "Upload"}
                </button>
              </div>

              {/* File name + delimiters, show File Name after file selection, delimiters always editable */}
              {disconnectedFile && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={disconnectedFile?.name || ""}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-gray-50 no-underline"
                      placeholder=" "
                    />
                    <label
                      className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none"
                    >
                      File Name
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.fieldDelimiter ?? ","}
                      onChange={(e) =>
                        handleInputChange("step3", "fieldDelimiter", e.target.value)
                      }
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label
                      className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none"
                    >
                      Field Delimiter
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.multivalueDelimiter ?? "#"}
                      onChange={(e) =>
                        handleInputChange("step3", "multivalueDelimiter", e.target.value)
                      }
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                      Multivalue Delimiter
                    </label>
                  </div>
                </div>
              )}

              {/* Fields / Uid / Status / Date Format / Multivalued Field (drag & drop from Fields) */}
              {disconnectedPreviewColumns.length > 0 && (
                <div className="border border-gray-300 rounded-lg bg-white p-5 shadow-sm space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fields
                    </label>
                    <div className="flex flex-wrap gap-2 border border-gray-200 rounded-md p-3 bg-gray-50/50">
                      {disconnectedPreviewColumns.map((fieldName) => (
                        <div
                          key={fieldName}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copy";
                            e.dataTransfer.setData("text/plain", fieldName);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing text-sm text-gray-900"
                        >
                          <span>{fieldName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200">
                      <input
                        type="text"
                        value={formData.step3.uidAttribute ?? ""}
                        readOnly
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fieldName =
                            (e.dataTransfer.getData("text/plain") ||
                              e.dataTransfer.getData("text") ||
                              "").trim();
                          if (fieldName) {
                            handleInputChange("step3", "uidAttribute", fieldName);
                          }
                        }}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline bg-gray-50"
                        placeholder=" "
                      />
                      {formData.step3.uidAttribute && (
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                          onClick={() => handleInputChange("step3", "uidAttribute", "")}
                          aria-label="Clear Uid Attribute"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <label
                        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                          formData.step3.uidAttribute
                            ? "top-0.5 text-xs text-blue-600"
                            : "top-3.5 text-sm text-gray-500"
                        }`}
                      >
                        Uid Attribute *
                      </label>
                    </div>
                    <div className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200">
                      <input
                        type="text"
                        value={formData.step3.statusField ?? ""}
                        readOnly
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fieldName =
                            (e.dataTransfer.getData("text/plain") ||
                              e.dataTransfer.getData("text") ||
                              "").trim();
                          if (fieldName) {
                            handleInputChange("step3", "statusField", fieldName);
                          }
                        }}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline bg-gray-50"
                        placeholder=" "
                      />
                      {formData.step3.statusField && (
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                          onClick={() => handleInputChange("step3", "statusField", "")}
                          aria-label="Clear Status Field"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <label
                        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                          formData.step3.statusField
                            ? "top-0.5 text-xs text-blue-600"
                            : "top-3.5 text-sm text-gray-500"
                        }`}
                      >
                        Status Field
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.step3.dateFormat ?? ""}
                        onChange={(e) =>
                          handleInputChange("step3", "dateFormat", e.target.value)
                        }
                        onDragOver={(e) => {
                          // Do not allow drag-and-drop into Date Format
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "none";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                        placeholder=" "
                      />
                      <label
                        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                          formData.step3.dateFormat
                            ? "top-0.5 text-xs text-blue-600"
                            : "top-3.5 text-sm text-gray-500"
                        }`}
                      >
                        Date Format
                      </label>
                    </div>
                    <div
                      className="relative rounded-md border-2 border-dashed border-transparent transition-colors hover:border-gray-200"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fieldName =
                          (e.dataTransfer.getData("text/plain") ||
                            e.dataTransfer.getData("text") ||
                            "").trim();
                        if (!fieldName) return;
                        const current = Array.isArray(formData.step3.multivaluedField)
                          ? (formData.step3.multivaluedField as string[])
                          : formData.step3.multivaluedField
                          ? [String(formData.step3.multivaluedField)]
                          : [];
                        if (!current.includes(fieldName)) {
                          handleInputChange("step3", "multivaluedField", [
                            ...current,
                            fieldName,
                          ]);
                        }
                      }}
                    >
                      <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                        Multivalued Field
                      </label>
                      <div className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-gray-50 min-h-[40px] flex flex-wrap items-center gap-2">
                        {Array.isArray(formData.step3.multivaluedField) &&
                          (formData.step3.multivaluedField as string[]).length > 0 &&
                          (formData.step3.multivaluedField as string[]).map((val) => (
                            <span
                              key={val}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200"
                            >
                              <span>{val}</span>
                              <button
                                type="button"
                                className="text-blue-400 hover:text-blue-700"
                                onClick={() => {
                                  const current =
                                    formData.step3.multivaluedField as string[];
                                  const updated = current.filter((v) => v !== val);
                                  const currentTypes =
                                    (formData.step3
                                      .multivaluedFieldEntitlementType as Record<
                                      string,
                                      string
                                    >) || {};
                                  const { [val]: _removed, ...restTypes } = currentTypes;
                                  handleInputChange("step3", "multivaluedField", updated);
                                  handleInputChange(
                                    "step3",
                                    "multivaluedFieldEntitlementType",
                                    restTypes
                                  );
                                }}
                                aria-label={`Remove ${val}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        {!Array.isArray(formData.step3.multivaluedField) &&
                          formData.step3.multivaluedField && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
                              <span>{String(formData.step3.multivaluedField)}</span>
                              <button
                                type="button"
                                className="text-blue-400 hover:text-blue-700"
                                onClick={() => {
                                  const key = String(formData.step3.multivaluedField);
                                  const currentTypes =
                                    (formData.step3
                                      .multivaluedFieldEntitlementType as Record<
                                      string,
                                      string
                                    >) || {};
                                  const { [key]: _removed, ...restTypes } = currentTypes;
                                  handleInputChange("step3", "multivaluedField", []);
                                  handleInputChange(
                                    "step3",
                                    "multivaluedFieldEntitlementType",
                                    restTypes
                                  );
                                }}
                                aria-label="Remove value"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                        {!formData.step3.multivaluedField && (
                          <span className="text-xs text-gray-400">
                            Drag fields here to add
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Entitlement type dropdowns shown below all 4 fields */}
                  {formData.step3.multivaluedField && (
                    <div className="mt-5 space-y-3">
                      <div className="text-sm font-medium text-gray-700">
                        Entitlement Type (for each multivalued field)
                      </div>
                            <div className="space-y-2">
                        {(
                          Array.isArray(formData.step3.multivaluedField)
                            ? (formData.step3.multivaluedField as string[])
                            : [String(formData.step3.multivaluedField)]
                        ).map((val) => {
                          const allTypes = ["Groups", "Roles", "Entitlement"];
                          const currentTypes =
                            (formData.step3
                              .multivaluedFieldEntitlementType as Record<string, string>) ||
                            {};
                          const currentValue = currentTypes[val] || "";
                          const selectedForOthers = new Set(
                            Object.entries(currentTypes)
                              .filter(([key]) => key !== val)
                              .map(([, v]) => v)
                          );
                          const availableOptions = allTypes.filter(
                            (t) => !selectedForOthers.has(t) || t === currentValue
                          );
                          return (
                            <div
                              key={val}
                              className="grid grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)] items-center gap-3 text-sm"
                            >
                              <span className="truncate text-gray-800">
                                {val}
                              </span>
                              <select
                                className="bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 w-full"
                                value={currentValue}
                                onChange={(e) => {
                                  const updatedTypes = {
                                    ...currentTypes,
                                    [val]: e.target.value,
                                  };
                                  handleInputChange(
                                    "step3",
                                    "multivaluedFieldEntitlementType",
                                    updatedTypes
                                  );
                                }}
                              >
                                <option value="">Select Entitlement Type</option>
                                {availableOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Save button before Preview (calls savebasemetadata/users; enabled only when Uid Attribute + Entitlement Type are set as required) */}
                  <div className="flex justify-end">
                    {(() => {
                      const mv = formData.step3.multivaluedField;
                      const mvList = Array.isArray(mv)
                        ? (mv as string[])
                        : mv
                        ? [String(mv)]
                        : [];
                      const types =
                        (formData.step3
                          .multivaluedFieldEntitlementType as Record<string, string>) ||
                        {};
                      const hasAllEntitlementTypes =
                        mvList.length === 0 ||
                        mvList.every((name) => !!types[name]);
                      const canSave =
                        !!formData.step3.uidAttribute &&
                        hasAllEntitlementTypes &&
                        !!disconnectedFile;
                      return (
                    <button
                      type="button"
                          disabled={!canSave}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => {
                            if (!canSave) return;
                            if (!disconnectedFile) return;
                            (async () => {
                              try {
                                const appName =
                                  formData.step2.applicationName?.trim() ||
                                  formData.step1.applicationName?.trim() ||
                                  "";
                                const mvField = formData.step3
                                  .multivaluedField;
                                const mvList = Array.isArray(mvField)
                                  ? (mvField as string[])
                                  : mvField
                                  ? [String(mvField)]
                                  : [];
                                const types =
                                  (formData.step3
                                    .multivaluedFieldEntitlementType as Record<
                                    string,
                                    string
                                  >) || {};
                                const parentFieldDefinition = {
                                  fieldNames: disconnectedPreviewColumns.join(
                                    ","
                                  ),
                                  fields: disconnectedPreviewColumns,
                                  uidAttribute:
                                    formData.step3.uidAttribute ?? "",
                                  statusField:
                                    formData.step3.statusField ?? "",
                                  dateFormat:
                                    formData.step3.dateFormat ?? "",
                                  multivaluedField: mvList,
                                };
                                const multivaluedFieldDefinition = mvList.map(
                                  (fieldName) => ({
                                    fieldName,
                                    uidAttribute: fieldName,
                                    entitlementName: "",
                                    entitlementType: types[fieldName] || "",
                                    entitlement: false,
                                  })
                                );
                                const payload = {
                                  tenantId: "ACMECOM",
                                  appId: "BASEREPO",
                                  applicationName: appName,
                                  appType: "users",
                                  fileName: disconnectedFile.name,
                                  parentFieldDefinition,
                                  multivaluedFieldDefinition,
                                  preview: disconnectedPreviewList,
                                  fieldDelimiter:
                                    formData.step3.fieldDelimiter ?? ",",
                                  multivalueDelimiter:
                                    formData.step3.multivalueDelimiter ?? "#",
                                };
                                const resp = await saveBaseMetadataUsers(
                                  payload
                                );
                                console.debug(
                                  "savebasemetadata/users success",
                                  resp
                                );
                                setDisconnectedMetadataSaved(true);
                              } catch (err) {
                                console.error(
                                  "savebasemetadata/users failed",
                                  err
                                );
                                alert(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to save base metadata. Please try again."
                                );
                              }
                            })();
                      }}
                    >
                      Save
                    </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              {disconnectedPreviewList.length > 0 && (
                <div className="border border-gray-300 rounded-lg bg-white overflow-hidden w-full">
                  <button
                    type="button"
                    onClick={() => setFlatfilePreviewCollapsed((c) => !c)}
                    className="flex items-center gap-2 px-4 py-3 w-full text-left border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                    aria-expanded={!flatfilePreviewCollapsed}
                  >
                    <ChevronDown
                      className={`w-5 h-5 text-blue-600 shrink-0 transition-transform ${
                        flatfilePreviewCollapsed ? "" : "rotate-180"
                      }`}
                      aria-hidden
                    />
                    <span className="text-blue-600 font-medium">Preview</span>
                  </button>
                  {!flatfilePreviewCollapsed && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs table-fixed border-collapse">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-200">
                              {disconnectedPreviewColumns.map((col) => (
                                <th
                                  key={col}
                                  className="px-2 py-2.5 font-semibold text-gray-700 align-top whitespace-normal break-words"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {disconnectedPreviewPageRows.map((row, rowIdx) => (
                              <tr
                                key={disconnectedPreviewStartIdx + rowIdx}
                                className="bg-white hover:bg-gray-50"
                              >
                                {disconnectedPreviewColumns.map((col) => (
                                  <td
                                    key={col}
                                    className="px-2 py-2 text-gray-900 whitespace-normal break-words align-top leading-snug"
                                  >
                                    {String((row as Record<string, unknown>)[col] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <button
                          type="button"
                          onClick={() =>
                            setFlatfilePreviewPage((p) => Math.max(1, p - 1))
                          }
                          disabled={flatfilePreviewPage <= 1}
                          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from(
                          { length: disconnectedTotalPreviewPages },
                          (_, i) => i + 1
                        )
                          .slice(0, 10)
                          .map((pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setFlatfilePreviewPage(pageNum)}
                              className={`min-w-[2rem] py-1.5 px-2 rounded text-sm font-medium ${
                                flatfilePreviewPage === pageNum
                                  ? "bg-blue-600 text-white"
                                  : "hover:bg-gray-200 text-gray-700"
                              }`}
                            >
                              {pageNum}
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() =>
                            setFlatfilePreviewPage((p) =>
                              Math.min(disconnectedTotalPreviewPages, p + 1)
                            )
                          }
                          disabled={flatfilePreviewPage >= disconnectedTotalPreviewPages}
                          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Per-field accordion for each Multivalued Field shown below Preview (only after base metadata save) */}
              {disconnectedMetadataSaved &&
                Array.isArray(formData.step3.multivaluedField) &&
                formData.step3.multivaluedField.length > 0 &&
                disconnectedPreviewList.length > 0 && (
                  <div className="mt-6 border border-gray-200 rounded-lg bg-white">
                    <div className="border-b border-gray-200 px-4 pt-3 pb-2">
                      <div className="text-sm font-medium text-gray-800">
                        Field Name
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {(formData.step3.multivaluedField as string[]).map(
                        (fieldName) => {
                          const step3 = formData.step3 as Record<string, any>;
                          const isExpanded =
                            disconnectedPerFieldExpanded[fieldName] ?? false;
                          const toggleExpanded = () =>
                            setDisconnectedPerFieldExpanded((prev) => ({
                              ...prev,
                              [fieldName]: !prev[fieldName],
                            }));

                          // For per‑multivalued field config, only show preview after a file is uploaded for that field
                          const fileName =
                            (step3[`mv_fileName_${fieldName}`] as string) || "";
                          const fieldDelimiterValue =
                            (step3[`mv_fieldDelimiter_${fieldName}`] as string) ??
                            (formData.step3.fieldDelimiter as string) ??
                            ",";
                          const multivalueDelimiterValue =
                            (step3[`mv_multivalueDelimiter_${fieldName}`] as string) ??
                            (formData.step3.multivalueDelimiter as string) ??
                            "#";
                          const selectedField =
                            (step3[`mv_field_${fieldName}`] as string) ||
                            fieldName;
                          const multivaluedList = Array.isArray(
                            formData.step3.multivaluedField
                          )
                            ? (formData.step3.multivaluedField as string[])
                            : [];
                          const primaryAttribute =
                            (step3.primaryAttribute as string) || "";

                          const fieldLabel =
                            fieldName
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (s) => s.toUpperCase())
                              .trim() + " Entity";

                          return (
                            <div key={fieldName} className="bg-white">
                              <button
                                type="button"
                                onClick={toggleExpanded}
                                className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? (
                                  <ChevronDown
                                    className="w-4 h-4 text-blue-600 shrink-0"
                                    aria-hidden
                                  />
                                ) : (
                                  <ChevronRight
                                    className="w-4 h-4 text-blue-600 shrink-0"
                                    aria-hidden
                                  />
                                )}
                                <span className="text-blue-600 font-medium">
                                  {fieldLabel}
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-200">
                                  {/* File Upload + config for this multivalued field */}
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium text-gray-700">
                                        File Upload
                                      </div>
                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        <input
                                          type="file"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0] ?? null;
                                            handleInputChange(
                                              "step3",
                                              `mv_fileName_${fieldName}`,
                                              file ? file.name : ""
                                            );
                                            setDisconnectedPerFieldFile((prev) => ({
                                              ...prev,
                                              [fieldName]: file,
                                            }));
                                            if (!file) {
                                              setDisconnectedPerFieldPreview((prev) => ({
                                                ...prev,
                                                [fieldName]: [],
                                              }));
                                            }
                                          }}
                                          className="flex-1 text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 border border-gray-300 rounded-md px-3 py-2"
                                        />
                                        <button
                                          type="button"
                                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium whitespace-nowrap"
                                          onClick={async () => {
                                            const file = disconnectedPerFieldFile[fieldName];
                                            if (!file) {
                                              alert("Please choose a file for this field first.");
                                              return;
                                            }
                                            const appName =
                                              formData.step2.applicationName?.trim() ||
                                              formData.step1.applicationName?.trim() ||
                                              "";
                                            if (!appName) {
                                              alert(
                                                "Please enter Application Name before uploading."
                                              );
                                              return;
                                            }
                                            try {
                                              const basicDefinition = {
                                                tenantId: "ACMECOM",
                                                applicationName: appName,
                                                fieldDelimiter: fieldDelimiterValue,
                                                multivalueDelimiter: multivalueDelimiterValue,
                                              };
                                              const data = await uploadAndGetSchemaForField(
                                                fieldName,
                                                file,
                                                basicDefinition
                                              );
                                              const anyData = data as any;
                                              const preview =
                                                (anyData &&
                                                  Array.isArray(anyData.preview) &&
                                                  anyData.preview) ||
                                                (Array.isArray(anyData) ? anyData : []);
                                              setDisconnectedPerFieldPreview((prev) => ({
                                                ...prev,
                                                [fieldName]: preview,
                                              }));
                                              console.debug(
                                                "uploadandgetschema/field response",
                                                fieldName,
                                                data
                                              );
                                            } catch (err) {
                                              console.error(
                                                "uploadandgetschema/field failed",
                                                fieldName,
                                                err
                                              );
                                              alert(
                                                err instanceof Error
                                                  ? err.message
                                                  : "Failed to upload file and fetch multivalued field schema. Please try again."
                                              );
                                            }
                                          }}
                                        >
                                          Upload
                                        </button>
                                      </div>
                                      {fileName && (
                                        <div className="mt-1 text-xs text-gray-600">
                                          File Name:{" "}
                                          <span className="font-medium text-gray-800">
                                            {fileName}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {disconnectedPerFieldPreview[fieldName] &&
                                      (disconnectedPerFieldPreview[fieldName] as any[]).length >
                                        0 && (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                        <div className="relative">
                                          <input
                                            type="text"
                                            value={fieldDelimiterValue}
                                            onChange={(e) =>
                                              handleInputChange(
                                                "step3",
                                                `mv_fieldDelimiter_${fieldName}`,
                                                e.target.value
                                              )
                                            }
                                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                            placeholder=" "
                                          />
                                          <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                                            Field Delimiter
                                          </label>
                                        </div>
                                        <div className="relative">
                                          <input
                                            type="text"
                                            value={multivalueDelimiterValue}
                                            onChange={(e) =>
                                              handleInputChange(
                                                "step3",
                                                `mv_multivalueDelimiter_${fieldName}`,
                                                e.target.value
                                              )
                                            }
                                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                                            placeholder=" "
                                          />
                                          <label className="absolute left-4 top-0.5 text-xs text-blue-600 pointer-events-none">
                                            Multivalue Delimiter
                                          </label>
                                        </div>
                                        <div className="flex flex-col max-w-xs">
                                          <span className="text-xs text-gray-500 mb-1">
                                            Primary Attribute
                                          </span>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
                                            value={primaryAttribute}
                                            onChange={(e) =>
                                              handleInputChange(
                                                "step3",
                                                "primaryAttribute",
                                                e.target.value
                                              )
                                            }
                                          >
                                            <option value="">Select</option>
                                            {multivaluedList.map((mv) => (
                                              <option key={mv} value={mv}>
                                                {mv}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Per-field preview for this multivalued attribute */}
                                  {fileName ? (
                                    <div className="overflow-x-auto border border-gray-200 rounded-md">
                                      <table className="w-full text-left text-xs table-fixed border-collapse">
                                        <thead>
                                          <tr className="bg-gray-100 border-b border-gray-200">
                                            <th className="px-2 py-2.5 font-semibold text-gray-700 align-top whitespace-normal break-words">
                                              {fieldName}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {(() => {
                                            const fromPerField =
                                              (disconnectedPerFieldPreview[fieldName] as any[]) ||
                                              [];
                                            const rows =
                                              fromPerField.length > 0
                                                ? fromPerField
                                                : disconnectedPreviewList.map((row) => ({
                                                    [fieldName]: (row as any)[fieldName],
                                                  }));
                                            return rows.map((row, rowIdx) => (
                                              <tr
                                                key={`mv-${rowIdx}`}
                                                className="bg-white hover:bg-gray-50"
                                              >
                                                <td className="px-2 py-2 text-gray-900 whitespace-normal break-words align-top leading-snug">
                                                  {String(
                                                    (row as Record<string, unknown>)[fieldName] ??
                                                      ""
                                                  )}
                                                </td>
                                              </tr>
                                            ));
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="border border-dashed border-gray-300 rounded-md px-4 py-6 text-xs text-gray-500 text-center">
                                      Upload a file for this field to see preview rows.
                                    </div>
                                  )}

                                  {fileName && (
                                    <div className="flex justify-end pt-3">
                                      <button
                                        type="button"
                                        disabled={
                                          !primaryAttribute ||
                                          (() => {
                                            const fromPerField =
                                              (disconnectedPerFieldPreview[fieldName] as any[]) ||
                                              [];
                                            const rows =
                                              fromPerField.length > 0
                                                ? fromPerField
                                                : disconnectedPreviewList.map((row) => ({
                                                    [fieldName]: (row as any)[fieldName],
                                                  }));
                                            return rows.length === 0;
                                          })()
                                        }
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        onClick={async () => {
                                          const fromPerField =
                                            (disconnectedPerFieldPreview[fieldName] as any[]) || [];
                                          const previewForField =
                                            fromPerField.length > 0
                                              ? fromPerField
                                              : disconnectedPreviewList.map((row) => ({
                                                  [fieldName]: (row as any)[fieldName],
                                                }));
                                          if (!primaryAttribute || previewForField.length === 0) {
                                            return;
                                          }
                                          try {
                                            const appName =
                                              formData.step2.applicationName?.trim() ||
                                              formData.step1.applicationName?.trim() ||
                                              "";
                                            const payload = {
                                              tenantId: "ACMECOM",
                                              appId: "BASEREPO",
                                              applicationName: appName,
                                              appType: fieldName,
                                              fileName,
                                              parentFieldDefinition: {
                                                fieldNames: fieldName,
                                                fields: [fieldName],
                                                uidAttribute: primaryAttribute,
                                                statusField: null,
                                                dateFormat: null,
                                                multivaluedField: [],
                                              },
                                              multivaluedFieldDefinition: [],
                                              preview: previewForField,
                                              fieldDelimiter: fieldDelimiterValue,
                                              multivalueDelimiter: multivalueDelimiterValue,
                                            };
                                            const resp = await saveBaseMetadataForField(
                                              fieldName,
                                              payload
                                            );
                                            console.debug(
                                              "savebasemetadata/field success",
                                              fieldName,
                                              resp
                                            );
                                          } catch (err) {
                                            console.error(
                                              "savebasemetadata/field failed",
                                              fieldName,
                                              err
                                            );
                                            alert(
                                              err instanceof Error
                                                ? err.message
                                                : "Failed to save multivalued field metadata. Please try again."
                                            );
                                          }
                                        }}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
            </div>
          );
        }

        if (
          isAiAgentWizard &&
          isGroupedOnboardApplicationType(formData.step1.type) &&
          !isCompleteIntegration &&
          !isIntegrationSchemaStepReady()
        ) {
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-amber-900">Schema Mapping not ready</h3>
              <p className="text-sm text-amber-800">
                {isScreenScrappingAiAgent ? (
                  <>
                    On the Integration step, enter <strong>baseURL</strong>, upload a JSON file, and
                    click <strong>Load Schema</strong>. Then you can map columns to source attributes
                    here.
                  </>
                ) : isRestLikeOnboardType ? (
                  <>
                    On the Integration step, enter Get All Users and click <strong>Load Schema</strong>.
                    Then you can map columns to source attributes here.
                  </>
                ) : (
                  <>
                    On the Integration step, test the database connection, enter Get All Users, and
                    click <strong>Load Schema</strong>. Then you can map columns to source attributes
                    here.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Go to Integration Settings
              </button>
            </div>
          );
        }

        if (isAiAgentWizard && isGroupedOnboardApplicationType(formData.step1.type) && !isCompleteIntegration) {
          return renderDatabaseSchemaMappingStep();
        }

        return (
          <div className="space-y-6">


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Existing Mappings Table */}
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source Attribute
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target Attribute
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Default Value
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getCurrentPageData().length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                            No attribute mappings configured.
                          </td>
                        </tr>
                      ) : (
                        getCurrentPageData().map((mapping, index) => (
                        <tr key={mapping.id ?? `row-${index}`}>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap break-words break-all align-top" style={{ position: "static", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {mapping.source}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap break-words break-all align-top" style={{ position: "static", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {mapping.target}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {mapping.defaultValue || ""}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                aria-label="Edit"
                                onClick={() => {
                                  setEditingAttribute(mapping);
                                  setIsEditingAttribute(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                aria-label="Delete"
                                onClick={() => handleDeleteMapping(mapping.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    onClick={() => setAttributeMappingPage(Math.max(1, attributeMappingPage - 1))}
                    disabled={attributeMappingPage === 1}
                    >
                      &lt;
                    </button>
                  <span className="text-sm text-gray-700">
                    Page {attributeMappingPage} of {getAttributeMappingTotalPages()}
                  </span>
                    <button
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    onClick={() => setAttributeMappingPage(Math.min(getAttributeMappingTotalPages(), attributeMappingPage + 1))}
                    disabled={attributeMappingPage === getAttributeMappingTotalPages()}
                    >
                      &gt;
                    </button>
                  </div>
                </div>

                {/* Action Buttons - Save calls saveappdetails API */}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={submitRequestLoading}
                    onClick={async () => {
                      setSubmitRequestError(null);
                      setSubmitRequestLoading(true);
                      try {
                        const ownerEmail = formData.step2.technicalOwnerEmail || formData.step2.businessOwnerEmail || "";
                        const step3 = formData.step3 || {};
                        const provisioningAttrMap: Record<string, { variable: string }> = {};
                        attributeMappingData.forEach((mapping) => {
                          if (mapping.target?.trim()) {
                            provisioningAttrMap[mapping.target.trim()] = { variable: mapping.source?.trim() ?? "" };
                          }
                        });
                        const userSearchBaseVal = String(step3.userSearchBase ?? step3.user_searchBase ?? "").trim();
                        const groupSearchBaseVal = String(step3.groupSearchBase ?? step3.group_searchBase ?? "").trim();
                        const { userSearchBase: _u2, groupSearchBase: _g2, user_searchBase: _ub2, group_searchBase: _gb2, ...step3Rest } = step3 as Record<string, unknown>;
                        const connectionDetails: Record<string, unknown> = {
                          ...step3Rest,
                          hostname: step3.hostname ?? "",
                          port: step3.port ?? "",
                          username: step3.username ?? "",
                          password: step3.password ?? "",
                          user_searchBase: userSearchBaseVal,
                          group_searchBase: groupSearchBaseVal,
                        };
                        const savePayload = {
                          tenantId: "ACMECOM",
                          appid: appIdFromUrl || "",
                          serviceURL: "",
                          name: formData.step2.applicationName || "",
                          description: formData.step2.description || "",
                          category: formData.step1.type || "",
                          owner: { type: "User", value: ownerEmail },
                          status: "InProgress",
                          connectionDetails,
                          dicoveredOn: null,
                          integratedOn: null,
                          schemaMappingDetails: {
                            provisioningAttrMap,
                            reconcilliationAttrMap: {},
                          },
                          applicationConfigurationDetails: null,
                          iga: false,
                          lcm: false,
                          sso: false,
                          ...(appIdFromUrl && !Number.isNaN(Number(appIdFromUrl)) ? { key: Number(appIdFromUrl) } : {}),
                        };
                        await saveAppDetails(savePayload);
                      } catch (err) {
                        const message = err instanceof Error ? err.message : "Failed to save application details";
                        setSubmitRequestError(message);
                      } finally {
                        setSubmitRequestLoading(false);
                      }
                    }}
                  >
                    {submitRequestLoading ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                    onClick={() => router.push("/settings/app-inventory")}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Add New Attribute Form or Edit Attribute Form */}
              <div className="space-y-4">
                {isEditingAttribute ? (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mapping Type
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editingAttribute?.type ?? "direct"}
                          onChange={(e) => setEditingAttribute((prev) => (prev ? { ...prev, type: e.target.value } : null))}
                        >
                          <option value="direct">Direct</option>
                          <option value="expression">Expression</option>
                          <option value="constant">Constant</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Attribute
                          <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editingAttribute?.target ?? ""}
                          onChange={(e) => setEditingAttribute((prev) => (prev ? { ...prev, target: e.target.value } : null))}
                        />
                        <div className="mt-2 flex justify-end">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              checked={editingAttribute?.keyfieldMapping ?? false}
                              onChange={(e) => setEditingAttribute((prev) => (prev ? { ...prev, keyfieldMapping: e.target.checked } : null))}
                            />
                            <span className="ml-2 text-sm text-gray-700">Keyfield</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Source Attribute
                          <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                          <span className="text-xs text-gray-500 ml-1">
                            Help
                          </span>
                        </label>
                        <div className="relative" ref={editDropdownRef}>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={editSourceAttributeValue || editingAttribute?.source || ""}
                            onChange={(e) => {
                              filterAttributes(e.target.value, true);
                            }}
                            onFocus={() => {
                              if (scimAttributes.length === 0 && !isLoadingAttributes) {
                                fetchScimAttributes();
                              }
                              setIsEditDropdownOpen(true);
                              filterAttributes(
                                editSourceAttributeValue || editingAttribute?.source || "",
                                true
                              );
                            }}
                            placeholder="Select or enter source attribute"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                            onClick={handleEditDropdownToggle}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isEditDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isEditDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100" style={{ scrollBehavior: 'smooth' }}>
                              {isLoadingAttributes ? (
                                <div className="px-4 py-2 text-sm text-gray-500">Loading attributes...</div>
                              ) : filteredAttributes.length > 0 ? (
                                filteredAttributes.map((attr, index) => (
                                  <div
                                    key={index}
                                    className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    onClick={() => selectAttribute(attr, true)}
                                  >
                                    {attr}
                                  </div>
                                ))
                              ) : (
                                <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Default value (optional)
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter default value"
                          value={editingAttribute?.defaultValue ?? ""}
                          onChange={(e) => setEditingAttribute((prev) => (prev ? { ...prev, defaultValue: e.target.value } : null))}
                        />
                      </div>
                    </div>

                    {/* Edit Form Action Buttons */}
                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                        onClick={saveEdit}
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                        onClick={() => {
                          setIsEditingAttribute(false);
                          setEditingAttribute(null);
                          setEditSourceAttributeValue("");
                          setIsEditDropdownOpen(false);
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mapping Type
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={mappingType ?? "direct"}
                          onChange={(e) => setMappingType(e.target.value)}
                        >
                          <option value="direct">Direct</option>
                          <option value="expression">Expression</option>
                          <option value="constant">Constant</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Source Attribute
                          <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                          <span className="text-xs text-gray-500 ml-1">
                            Help
                          </span>
                        </label>
                        <div className="relative" ref={dropdownRef}>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={sourceAttributeValue ?? ""}
                            onChange={(e) => {
                              filterAttributes(e.target.value, false);
                            }}
                            onFocus={() => {
                              if (scimAttributes.length === 0 && !isLoadingAttributes) {
                                fetchScimAttributes();
                              }
                              setIsDropdownOpen(true);
                              filterAttributes(sourceAttributeValue, false);
                            }}
                            placeholder="Select or enter source attribute"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                            onClick={handleDropdownToggle}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100" style={{ scrollBehavior: 'smooth' }}>
                              {isLoadingAttributes ? (
                                <div className="px-4 py-2 text-sm text-gray-500">Loading attributes...</div>
                              ) : filteredAttributes.length > 0 ? (
                                filteredAttributes.map((attr, index) => (
                                  <div
                                    key={index}
                                    className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    onClick={() => selectAttribute(attr, false)}
                                  >
                                    {attr}
                                  </div>
                                ))
                              ) : (
                                <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Attribute
                          <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter target attribute"
                            value={targetAttributeValue ?? ""}
                            onChange={(e) => setTargetAttributeValue(e.target.value)}
                          />
                          <button className="absolute right-2 top-2 text-gray-400">
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              checked={keyfieldChecked}
                              onChange={(e) => setKeyfieldChecked(e.target.checked)}
                            />
                            <span className="ml-2 text-sm text-gray-700">Keyfield</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Default value (optional)
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter default value"
                          value={defaultAttributeValue ?? ""}
                          onChange={(e) => setDefaultAttributeValue(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Add Form Action Buttons */}
                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={!sourceAttributeValue.trim() || !targetAttributeValue.trim()}
                        onClick={handleAddMapping}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                        onClick={() => {
                          setSourceAttributeValue("");
                          setTargetAttributeValue("");
                          setDefaultAttributeValue("");
                          setKeyfieldChecked(false);
                          setMappingType("direct");
                          setIsDropdownOpen(false);
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        if (isAiAgentWizard) {
          return <div className="space-y-6">{renderFinishUpSummary()}</div>;
        }

        // For Disconnected Application (create + edit), step 5 should be Schema Mapping
        if (formData.step1.type === "Disconnected Application") {
          return renderSchemaMappingStep();
        }

        // For all other flows, step 5 is Finish Up (summary only)
        return <div className="space-y-6">{renderFinishUpSummary()}</div>;

      case 6:
        // Step 6 is only reachable for new Disconnected apps — Finish Up
        return <div className="space-y-6">{renderFinishUpSummary()}</div>;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed step bar with Previous / steps / Next — aligned with other wizards */}
      <div
        className="fixed top-[60px] z-20 bg-white border-b border-gray-200 shadow-sm px-3 sm:px-4 py-2.5 sm:py-3"
        style={{
          left: isSidebarVisible ? sidebarWidthPx : 0,
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 max-w-full min-w-0">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={
              (!isCompleteIntegration && currentStep === 1 && !isAiAgentWizard) ||
              submitRequestLoading
            }
            className={`flex items-center px-2.5 sm:px-3 py-2 rounded-md text-sm font-medium shrink-0 ${
              (!isCompleteIntegration && currentStep === 1 && !isAiAgentWizard) ||
              submitRequestLoading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-1.5" />
            {isCompleteIntegration && currentStep === 3
              ? "Back to Inventory"
              : isAiAgentWizard && currentStep === 1
                ? "Back to Integrations"
                : "Previous"}
          </button>

          <div className="flex-1 flex items-center justify-between min-w-0 overflow-x-auto">
            {(() => {
              const isDisconnected = formData.step1.type === "Disconnected Application";
              const stepsShown = isAiAgentWizard
                ? wizardSteps
                : isCompleteIntegration
                  ? isDisconnected
                    ? steps.filter((s) => s.id >= 3 && s.id <= 6)
                    : steps.filter((s) => s.id >= 3 && s.id <= 5)
                  : isDisconnected
                    ? steps
                    : steps.filter((s) => s.id <= 5);
              const needsSchemaGating =
                isAiAgentWizard && isGroupedOnboardApplicationType(formData.step1.type);
              return stepsShown.map((step, index) => {
                const stepReachable =
                  isCompleteIntegration ||
                  step.id <= 3 ||
                  !needsSchemaGating ||
                  isIntegrationSchemaStepReady();
                const isClickable = (isCompleteIntegration || step.id > 1) && stepReachable;
                const displayNumber =
                  isCompleteIntegration || isAiAgentWizard ? index + 1 : step.id;
                return (
                  <div
                    key={step.id}
                    className={`flex items-center min-w-0 shrink-0 ${isClickable ? "cursor-pointer" : ""}`}
                    onClick={isClickable ? () => setCurrentStep(step.id) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCurrentStep(step.id);
                            }
                          }
                        : undefined
                    }
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={
                      isClickable ? `Go to step ${displayNumber}: ${step.title}` : undefined
                    }
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border shrink-0 ${
                        currentStep >= step.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300"
                      } ${isClickable ? "hover:ring-2 hover:ring-blue-400" : ""}`}
                    >
                      {currentStep > step.id ? <Check className="w-4 h-4" /> : displayNumber}
                    </div>
                    <div className="ml-2 sm:ml-2.5 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                        {(() => {
                          if (isAiAgentWizard) return step.title;
                          const type = formData.step1.type;
                          if (type === "Flatfile" && step.id === 3) return "File Upload";
                          if (type === "Disconnected Application") {
                            if (step.id === 4) return "File Upload";
                            if (step.id === 5) return "Schema Mapping";
                            if (step.id === 6) return "Finish Up";
                          } else {
                            if (step.id === 4) return "Schema Mapping";
                            if (step.id === 5) return "Finish Up";
                          }
                          return step.title;
                        })()}
                      </p>
                    </div>
                    {index < stepsShown.length - 1 && (
                      <div className="flex-1 h-0.5 bg-gray-200 mx-2 sm:mx-4 min-w-[12px] sm:min-w-[16px]" />
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <div className="shrink-0 flex flex-wrap gap-2 sm:gap-3 justify-end">
            {currentStep <
            (isAiAgentWizard
              ? 5
              : !isCompleteIntegration && formData.step1.type === "Disconnected Application"
                ? 6
                : 5) ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={
                  submitRequestLoading ||
                  (currentStep === 1 && (isLoadingAppTypes || !formData.step1.type?.trim())) ||
                  (currentStep === 2 && !formData.step2.sourceType?.trim()) ||
                  (isAiAgentWizard &&
                    currentStep === 3 &&
                    isGroupedOnboardApplicationType(formData.step1.type) &&
                    !isIntegrationStepThreeReady())
                }
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  submitRequestLoading
                    ? "bg-blue-600 text-white opacity-60 cursor-not-allowed"
                    : (currentStep === 1 &&
                        (isLoadingAppTypes || !formData.step1.type?.trim())) ||
                      (currentStep === 2 && !formData.step2.sourceType?.trim())
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {submitRequestLoading ? "Submitting…" : currentStep === 1 ? "Next" : "Save and Next"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : !isCompleteIntegration ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitRequestLoading}
                className={`flex items-center px-2.5 sm:px-3 py-2 rounded-md text-sm font-medium ${
                  submitRequestLoading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                <Check className="w-4 h-4 mr-1.5" />
                {submitRequestLoading ? "Submitting..." : "Submit Application"}
              </button>
            ) : null}
            {isCompleteIntegration && formData.step1.type === "Disconnected Application" && currentStep === 6 && (
              <button
                type="button"
                className="flex items-center px-2.5 sm:px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={onboardLoading || submitRequestLoading}
                onClick={async () => {
                  if (onboardLoading || submitRequestLoading) return;
                  setSubmitRequestError(null);
                  setOnboardLoading(true);
                  try {
                    const ownerEmail = formData.step2.technicalOwnerEmail || formData.step2.businessOwnerEmail || "";
                    const step3 = formData.step3 || {};
                    const provisioningAttrMap: Record<string, { variable: string }> = {};
                    attributeMappingData.forEach((mapping) => {
                      if (mapping.target?.trim()) {
                        provisioningAttrMap[mapping.target.trim()] = { variable: mapping.source?.trim() ?? "" };
                      }
                    });
                    const userSearchBaseVal = String(step3.userSearchBase ?? step3.user_searchBase ?? "").trim();
                    const groupSearchBaseVal = String(step3.groupSearchBase ?? step3.group_searchBase ?? "").trim();
                    const { userSearchBase: _uo, groupSearchBase: _go, user_searchBase: _ubo, group_searchBase: _gbo, ...step3Rest } = step3 as Record<string, unknown>;
                    const connectionDetails: Record<string, unknown> = {
                      ...step3Rest,
                      hostname: step3.hostname ?? "",
                      port: step3.port ?? "",
                      username: step3.username ?? "",
                      password: step3.password ?? "",
                      user_searchBase: userSearchBaseVal,
                      group_searchBase: groupSearchBaseVal,
                    };
                    const onboardPayload = {
                      tenantId: "ACMECOM",
                      appid: appIdFromUrl || "",
                      serviceURL: "",
                      name: formData.step2.applicationName || "",
                      description: formData.step2.description || "",
                      category: formData.step1.type || "",
                      owner: { type: "User", value: ownerEmail },
                      status: "InProgress",
                      connectionDetails,
                      dicoveredOn: null,
                      integratedOn: null,
                      schemaMappingDetails: {
                        provisioningAttrMap,
                        reconcilliationAttrMap: {},
                      },
                      applicationConfigurationDetails: null,
                      iga: false,
                      lcm: false,
                      sso: false,
                      ...(appIdFromUrl && !Number.isNaN(Number(appIdFromUrl)) ? { key: Number(appIdFromUrl) } : {}),
                    };
                    await onboardApp(onboardPayload);
                    router.push("/settings/app-inventory");
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Failed to onboard application";
                    setSubmitRequestError(message);
                  } finally {
                    setOnboardLoading(false);
                  }
                }}
              >
                {onboardLoading ? "Onboarding…" : "OnBoard"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="h-[64px] sm:h-[68px]" aria-hidden />

      <div className="w-full pt-0 pb-8 px-3 sm:px-4">
        {submitRequestError && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
            {submitRequestError}
          </div>
        )}
        {/* Edit mode: app summary card from IT Asset getapp */}
        {isCompleteIntegration && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex">
            <div className="w-1.5 shrink-0 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-l-xl" aria-hidden />
            <div className="flex-1 p-6">
              {appDetailsLoading ? (
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                  <span className="text-sm font-medium">Loading…</span>
                </div>
              ) : appDetails ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 sm:gap-y-0">
                    {[
                      { label: "Application Name", keys: ["applicationName", "ApplicationName", "name", "Name"] },
                      { label: "Category", keys: ["category", "Category", "applicationType", "ApplicationType"] },
                      { label: "Owner", keys: ["owner", "Owner"] },
                    ].map(({ label, keys }, i) => {
                      let val = keys.reduce<unknown>((acc, k) => acc != null && acc !== "" ? acc : appDetails[k], null);
                      if (label === "Owner" && typeof val === "object" && val !== null && "value" in val) {
                        val = (val as { value?: unknown }).value;
                      }
                      const display = typeof val === "object" && val !== null ? JSON.stringify(val) : val != null && val !== "" ? String(val) : "—";
                      return (
                        <div
                          key={label}
                          className={`flex items-baseline gap-2 min-w-0 ${i < 2 ? "sm:border-r sm:border-gray-200 sm:pr-6" : ""}`}
                        >
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">{label}:</span>
                          <span className="text-[15px] font-semibold text-gray-900 leading-snug break-words min-w-0" title={display}>
                            {display}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <label htmlFor="edit-mode-description" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Description
                    </label>
                    <textarea
                      id="edit-mode-description"
                      rows={2}
                      className="w-full px-3 py-2 text-[15px] font-medium text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[60px]"
                      placeholder="Enter description"
                      value={formData.step2.description ?? ""}
                      onChange={(e) => handleInputChange("step2", "description", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 font-medium">Could not load details.</p>
              )}
            </div>
          </div>
        )}

        {submitRequestLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="flex flex-col items-center gap-4">
              {submitProgressToast && (
                <div className="max-w-sm bg-green-100 text-green-900 px-4 py-3 rounded-lg shadow-xl border border-green-300 text-sm">
                  {submitProgressToast}
                </div>
              )}
              <div className="w-12 h-12 rounded-full border-4 border-white/40 border-t-white animate-spin" />
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
