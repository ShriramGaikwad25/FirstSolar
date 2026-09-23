"use client";

import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit, Trash2, X, Plus, PlusCircle, Ban, Calendar, Loader2, Plug, Workflow, Webhook, Gauge, LogIn, LogOut, ListChecks, Settings2, type LucideIcon } from "lucide-react";
import ToggleSwitch from "@/components/ToggleSwitch";
import {
  updateAppConfig,
  getApplicationDetails,
  getAllSupportedApplicationTypesViaProxy,
  getMappedSchema,
  integratedIgaSourceKeysFromMappedSchema,
  buildMapFieldsPayloadWithTransformations,
  mapSchemaFields,
  transformationMappingsFromMappedSchema,
  parseSupportedObjectsApplicationTypeItem,
  type ApplicationTypeIntegrationFieldGroup,
} from "@/lib/api";
import IntegrationAdvancedSettingGroups from "./IntegrationAdvancedSettingGroups";

type EventTabId = "pre-process" | "post-process";

type AdvancedSectionId = "connection" | "transformation" | "hooks" | "threshold";

const ADVANCED_SECTION_META: Record<
  AdvancedSectionId,
  { label: string; icon: LucideIcon; active: string; iconActive: string; idle: string; iconIdle: string }
> = {
  connection: {
    label: "Connection Parameters",
    icon: Plug,
    active: "bg-white shadow-sm text-blue-700 border border-blue-300",
    iconActive: "text-blue-600",
    idle: "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300",
    iconIdle: "text-blue-500",
  },
  transformation: {
    label: "Transformation Provider",
    icon: Workflow,
    active: "bg-white shadow-sm text-violet-700 border border-violet-300",
    iconActive: "text-violet-600",
    idle: "bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300",
    iconIdle: "text-violet-500",
  },
  hooks: {
    label: "Hooks",
    icon: Webhook,
    active: "bg-white shadow-sm text-indigo-700 border border-indigo-300",
    iconActive: "text-indigo-600",
    idle: "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300",
    iconIdle: "text-indigo-500",
  },
  threshold: {
    label: "Target System Provisioning Threshold",
    icon: Gauge,
    active: "bg-white shadow-sm text-amber-700 border border-amber-300",
    iconActive: "text-amber-600",
    idle: "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300",
    iconIdle: "text-amber-500",
  },
};

type ServiceRow = {
  id: string;
  endpoint: string;
  authorization: string;
  operation: string;
  isEnabled: boolean;
  customHeaders: Array<{ name: string; value: string }>;
};

type SdkRow = {
  id: string;
  implementationClass: string;
  agentId: string;
  operation: string;
  isEnabled: boolean;
};

type ThresholdOp = "disable" | "create" | "delete";

const THRESHOLD_OP_META: Record<
  ThresholdOp,
  { icon: LucideIcon; border: string; iconBadge: string; eyebrow: string; ring: string }
> = {
  disable: {
    icon: Ban,
    border: "border-l-amber-400",
    iconBadge: "bg-amber-100 text-amber-700",
    eyebrow: "text-amber-700",
    ring: "focus:ring-amber-500 focus:border-amber-500",
  },
  create: {
    icon: PlusCircle,
    border: "border-l-emerald-400",
    iconBadge: "bg-emerald-100 text-emerald-700",
    eyebrow: "text-emerald-700",
    ring: "focus:ring-emerald-500 focus:border-emerald-500",
  },
  delete: {
    icon: Trash2,
    border: "border-l-rose-400",
    iconBadge: "bg-rose-100 text-rose-700",
    eyebrow: "text-rose-700",
    ring: "focus:ring-rose-500 focus:border-rose-500",
  },
};

type ThresholdState = { maxLimit: number; minutes: number; action: string; email: string };
type PeakDayRange = { id: string; startDate: string; endDate: string };
type ExceptionalState = {
  isExceptionalExpanded: boolean;
  isPeakDaysExpanded: boolean;
  isPeakTimeExpanded: boolean;
  peakDays: PeakDayRange[];
  peakTimes: PeakDayRange[];
};

const initialThresholdState: ThresholdState = {
  maxLimit: -1,
  minutes: 0,
  action: "continue",
  email: "",
};

const initialExceptionalState: ExceptionalState = {
  isExceptionalExpanded: false,
  isPeakDaysExpanded: false,
  isPeakTimeExpanded: false,
  peakDays: [{ id: "peak-1", startDate: "", endDate: "" }],
  peakTimes: [{ id: "peak-time-1", startDate: "", endDate: "" }],
};

const SHOW_SDK_SECTION = false;

const initialEventTabState = {
  isServiceExpanded: false,
  isSDKExpanded: false,
  activeOperation: "create" as const,
  activeSDKOperation: "create" as const,
};

const defaultAppAccessRule = {
  revokeAccess: { entitlements: [], roles: [], groups: [] },
  ruleName: "",
  description: "",
  rule: {},
  ruleElements: [],
  setAttributes: [],
  createdOn: "",
  assignAccess: { entitlements: [], roles: [], groups: [] },
  status: false,
};

const defaultAutoRetry = { isEnabled: false, interval: -1, maximumRetry: 0 };

/** Reverse of buildApplicationConfig(): hydrate hooks/threshold UI state from a fetched app's saved config. */
function parseSavedApplicationConfig(app: Record<string, unknown>): {
  hookName: string;
  serviceRowsByEventTab: Record<EventTabId, ServiceRow[]>;
  sdkRowsByEventTab: Record<EventTabId, SdkRow[]>;
  thresholdByOperation: Partial<Record<ThresholdOp, ThresholdState>>;
  exceptionalByOperation: Partial<Record<ThresholdOp, ExceptionalState>>;
} | null {
  const config =
    (app.applicationConfigurationDetails as Record<string, unknown> | undefined) ??
    (app.ApplicationConfigurationDetails as Record<string, unknown> | undefined) ??
    (app.applicationConfig as Record<string, unknown> | undefined) ??
    (app.ApplicationConfig as Record<string, unknown> | undefined) ??
    null;
  if (!config || typeof config !== "object") return null;

  const hook = (config.hook ?? config.Hook ?? {}) as Record<string, unknown>;
  const hookName = typeof hook.name === "string" ? hook.name : "";

  const toRows = (events: unknown): { services: ServiceRow[]; sdks: SdkRow[] } => {
    const services: ServiceRow[] = [];
    const sdks: SdkRow[] = [];
    if (!Array.isArray(events)) return { services, sdks };
    events.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return;
      const e = raw as Record<string, unknown>;
      const type = String(e.type ?? "").toLowerCase();
      if (type === "sdk") {
        const implementationClass = String(e.implementationClass ?? "").trim();
        const agentId = String(e.agentId ?? "").trim();
        if (!implementationClass && !agentId) return;
        sdks.push({
          id: `sdk-${index}-${Date.now()}`,
          implementationClass,
          agentId,
          operation: String(e.operation ?? ""),
          isEnabled: Boolean(e.isEnabled),
        });
      } else if (type === "service") {
        const endpoint = String(e.endpoint ?? "").trim();
        const authorization = String(e.authorization ?? "").trim();
        if (!endpoint && !authorization) return;
        const rawHeaders = e.customHeaders;
        const customHeaders: Array<{ name: string; value: string }> = Array.isArray(rawHeaders)
          ? rawHeaders
              .filter((h) => h && typeof h === "object")
              .map((h: any) => ({ name: String(h.name ?? ""), value: String(h.value ?? "") }))
          : rawHeaders && typeof rawHeaders === "object"
          ? Object.entries(rawHeaders as Record<string, unknown>).map(([name, value]) => ({
              name,
              value: String(value ?? ""),
            }))
          : [];
        services.push({
          id: `service-${index}-${Date.now()}`,
          endpoint,
          authorization,
          operation: String(e.operation ?? ""),
          isEnabled: Boolean(e.isEnabled),
          customHeaders,
        });
      }
    });
    return { services, sdks };
  };

  const pre = toRows(hook.preProcessEvent ?? hook.PreProcessEvent);
  const post = toRows(hook.postProcessEvent ?? hook.PostProcessEvent);

  const thresholdList = (config.threshold ?? config.Threshold ?? []) as unknown[];
  const thresholdByOperation: Partial<Record<ThresholdOp, ThresholdState>> = {};
  const exceptionalByOperation: Partial<Record<ThresholdOp, ExceptionalState>> = {};
  if (Array.isArray(thresholdList)) {
    thresholdList.forEach((raw) => {
      if (!raw || typeof raw !== "object") return;
      const t = raw as Record<string, unknown>;
      const opLabel = String(t.operation ?? "").toLowerCase();
      const op: ThresholdOp | null =
        opLabel === "disable" ? "disable" : opLabel === "create" ? "create" : opLabel === "delete" ? "delete" : null;
      if (!op) return;
      const cutOff = (t.cutOff ?? t.CutOff ?? {}) as Record<string, unknown>;
      thresholdByOperation[op] = {
        maxLimit: typeof cutOff.maximumAllowed === "number" ? cutOff.maximumAllowed : initialThresholdState.maxLimit,
        minutes: typeof cutOff.durationInMinutes === "number" ? cutOff.durationInMinutes : initialThresholdState.minutes,
        action: cutOff.stopFurtherOperations ? "stop" : "continue",
        email: typeof cutOff.sendAlertTo === "string" ? cutOff.sendAlertTo : "",
      };
      const exceptionalCases = (t.exceptionalCases ?? t.ExceptionalCases ?? {}) as Record<string, unknown>;
      const peakDaysRaw = Array.isArray(exceptionalCases.peakDays) ? exceptionalCases.peakDays : [];
      const peakTimesRaw = Array.isArray(exceptionalCases.peakTime) ? exceptionalCases.peakTime : [];
      exceptionalByOperation[op] = {
        isExceptionalExpanded: false,
        isPeakDaysExpanded: false,
        isPeakTimeExpanded: false,
        peakDays: peakDaysRaw.map((r: any, i: number) => ({
          id: `peak-day-${op}-${i}`,
          startDate: String(r?.startDate ?? ""),
          endDate: String(r?.endData ?? ""),
        })),
        peakTimes: peakTimesRaw.map((r: any, i: number) => ({
          id: `peak-time-${op}-${i}`,
          startDate: String(r?.startTime ?? ""),
          endDate: String(r?.endTime ?? ""),
        })),
      };
    });
  }

  return {
    hookName,
    serviceRowsByEventTab: { "pre-process": pre.services, "post-process": post.services },
    sdkRowsByEventTab: { "pre-process": pre.sdks, "post-process": post.sdks },
    thresholdByOperation,
    exceptionalByOperation,
  };
}

const CEL_EXPRESSIONS_BASE = "/api/celmodule/expressions";
/** Same endpoint as Schema Mapping Source Attribute list. */
const SCIM_ATTRIBUTES_URL = "https://preview.keyforge.ai/schemamapper/getscim/ACMECOM";

type CelExpressionOption = { id: number; name: string };

function buildCelExpressionsUrl(appId: string, applicationType: string): string {
  const params = new URLSearchParams();
  params.append("category", appId.trim());
  params.append("category", applicationType.trim());
  return `${CEL_EXPRESSIONS_BASE}?${params.toString()}`;
}

function buildOutboundExpressionsUrl(): string {
  const params = new URLSearchParams();
  params.append("category", "outBound");
  return `${CEL_EXPRESSIONS_BASE}?${params.toString()}`;
}

function parseCelExpressionsList(data: unknown): CelExpressionOption[] {
  const raw = Array.isArray(data)
    ? data
    : data != null && typeof data === "object" && Array.isArray((data as { expressions?: unknown }).expressions)
      ? (data as { expressions: unknown[] }).expressions
      : [];
  return raw
    .map((item, i) => {
      if (item == null || typeof item !== "object") return null;
      const row = item as { id?: unknown; name?: unknown };
      const name = String(row.name ?? "").trim();
      if (!name) return null;
      const id = Number(row.id);
      return { id: Number.isFinite(id) && id >= 0 ? id : i + 1, name };
    })
    .filter((x): x is CelExpressionOption => x != null);
}

function parseScimAttributesList(data: unknown): string[] {
  if (data != null && typeof data === "object" && Array.isArray((data as { scimAttributes?: unknown }).scimAttributes)) {
    return (data as { scimAttributes: unknown[] }).scimAttributes
      .map((a) => String(a).trim())
      .filter(Boolean);
  }
  if (Array.isArray(data)) {
    return data.map((a) => String(a).trim()).filter(Boolean);
  }
  return [];
}

function dedupeOptionsByName<T extends { id: number; name: string }>(items: T[]): T[] {
  const byName = new Map<string, T>();
  for (const item of items) {
    const name = item.name.trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, item);
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
type InboundTransformationMappingRow = {
  id: string;
  igaField: string;
  transformationProvider: string;
};

type OutboundTransformationMappingRow = {
  id: string;
  targetField: string;
  transformationProvider: string;
};

export type AdvanceSettingTabRef = {
  /** Returns current hooks + threshold config (for use in wizard submit / OnBoard). */
  getConfig: () => Record<string, unknown>;
};

type AdvanceSettingTabProps = {
  applicationId: string;
  /** When true, only show Hooks + Target System Provisioning Threshold (e.g. in add-application step 5); hide Submit/Cancel. */
  wizardMode?: boolean;
  /** Load and show per-type integration advanced setting groups (connection parameters, etc.). */
  showIntegrationAdvancedGroups?: boolean;
  /** Optional: parent supplies groups/values (wizard). If omitted, loaded from app + supported-objects when `showIntegrationAdvancedGroups`. */
  integrationFieldGroups?: ApplicationTypeIntegrationFieldGroup[];
  integrationFieldValues?: Record<string, string>;
  onIntegrationFieldChange?: (fieldKey: string, value: string) => void;
  applicationCategory?: string;
  /** App id for getmappedschema when `applicationId` is `wizard` (complete-integration / post–newApp). */
  mappedSchemaApplicationId?: string;
  /** When false, hides Transformation Provider, Hooks, and Threshold (new-app create wizard). */
  showHooksThresholdAndTransformation?: boolean;
  /** Called when Cancel is clicked. If not provided, navigates to /settings/app-inventory */
  onCancel?: () => void;
};

const AdvanceSettingTab = forwardRef<AdvanceSettingTabRef, AdvanceSettingTabProps>(function AdvanceSettingTab(
  {
    applicationId,
    wizardMode,
    showIntegrationAdvancedGroups,
    integrationFieldGroups: integrationFieldGroupsProp,
    integrationFieldValues: integrationFieldValuesProp,
    onIntegrationFieldChange,
    applicationCategory: applicationCategoryProp,
    mappedSchemaApplicationId,
    showHooksThresholdAndTransformation = true,
    onCancel,
  },
  ref
) {
  const router = useRouter();
  const [activeAdvancedSection, setActiveAdvancedSection] = useState<AdvancedSectionId>(
    showIntegrationAdvancedGroups ? "connection" : "transformation"
  );
  const didInitAdvancedSection = useRef(false);
  const [isInboundTransformationExpanded, setIsInboundTransformationExpanded] = useState(false);
  const [isOutboundTransformationExpanded, setIsOutboundTransformationExpanded] = useState(false);
  const [inboundIgaField, setInboundIgaField] = useState("");
  const [inboundTransformationProvider, setInboundTransformationProvider] = useState("");
  const [inboundMappingRows, setInboundMappingRows] = useState<InboundTransformationMappingRow[]>([]);
  const [scimAttributes, setScimAttributes] = useState<string[]>([]);
  const [integratedIgaSourceKeys, setIntegratedIgaSourceKeys] = useState<Set<string>>(() => new Set());
  const [filteredIgaSource, setFilteredIgaSource] = useState<string[]>([]);
  const [igaSourceDropdownOpen, setIgaSourceDropdownOpen] = useState(false);
  const [igaDropdownRect, setIgaDropdownRect] = useState<DOMRect | null>(null);
  const igaSourceRef = useRef<HTMLDivElement>(null);
  const igaDropdownPortalRef = useRef<HTMLDivElement>(null);
  const [inboundTransformationProviderOptions, setInboundTransformationProviderOptions] = useState<
    CelExpressionOption[]
  >([]);
  const [outboundTargetField, setOutboundTargetField] = useState("");
  const [outboundTransformationProvider, setOutboundTransformationProvider] = useState("");
  const [outboundMappingRows, setOutboundMappingRows] = useState<OutboundTransformationMappingRow[]>([]);
  const [outboundTransformationProviderOptions, setOutboundTransformationProviderOptions] = useState<
    CelExpressionOption[]
  >([]);
  const [inboundOptionsLoading, setInboundOptionsLoading] = useState(false);
  const [outboundOptionsLoading, setOutboundOptionsLoading] = useState(false);
  const [inboundOptionsError, setInboundOptionsError] = useState<string | null>(null);
  const [outboundOptionsError, setOutboundOptionsError] = useState<string | null>(null);
  const [isTransformationSaving, setIsTransformationSaving] = useState(false);
  const [transformationSaveError, setTransformationSaveError] = useState<string | null>(null);
  const [transformationSaveSuccess, setTransformationSaveSuccess] = useState(false);
  const [loadedIntegrationGroups, setLoadedIntegrationGroups] = useState<ApplicationTypeIntegrationFieldGroup[]>(
    []
  );
  const [loadedIntegrationValues, setLoadedIntegrationValues] = useState<Record<string, string>>({});
  const [integrationGroupsLoading, setIntegrationGroupsLoading] = useState(false);
  const [detectedApplicationCategory, setDetectedApplicationCategory] = useState("");
  /** Active Directory Domain: Advanced sub-section expand/collapse (same as add-application / Configuration tab). */
  const [adDomainAdvancedExpanded, setAdDomainAdvancedExpanded] = useState(false);
  /** Active Directory Domain: Inherited Global Policies — locked until its own Edit is clicked. */
  const [inheritedPoliciesEditing, setInheritedPoliciesEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<EventTabId>("pre-process");
  const [eventTabState, setEventTabState] = useState<Record<EventTabId, typeof initialEventTabState>>({
    "pre-process": { ...initialEventTabState },
    "post-process": { ...initialEventTabState },
  });
  const [hookName, setHookName] = useState("");
  // Process Event modal (Add Service)
  const [isProcessEventModalOpen, setIsProcessEventModalOpen] = useState(false);
  const [processEventForm, setProcessEventForm] = useState({
    endpoint: "",
    authorization: "",
    operation: "Create",
    isEnabled: false,
  });
  const [customHeaders, setCustomHeaders] = useState<Array<{ name: string; value: string }>>([]);
  const [serviceRowsByEventTab, setServiceRowsByEventTab] = useState<Record<EventTabId, ServiceRow[]>>({
    "pre-process": [],
    "post-process": [],
  });
  // SDK modal (Add SDK)
  const [isSdkModalOpen, setIsSdkModalOpen] = useState(false);
  const [sdkForm, setSdkForm] = useState({
    implementationClass: "",
    agentId: "",
    operation: "Create",
    isEnabled: false,
  });
  const [sdkRowsByEventTab, setSdkRowsByEventTab] = useState<Record<EventTabId, SdkRow[]>>({
    "pre-process": [],
    "post-process": [],
  });
  // Target System Provisioning Threshold (per operation)
  const [thresholdByOperation, setThresholdByOperation] = useState<Record<ThresholdOp, ThresholdState>>({
    disable: { ...initialThresholdState },
    create: { ...initialThresholdState },
    delete: { ...initialThresholdState },
  });
  const [exceptionalByOperation, setExceptionalByOperation] = useState<
    Record<ThresholdOp, ExceptionalState>
  >({
    disable: { ...initialExceptionalState },
    create: { ...initialExceptionalState },
    delete: { ...initialExceptionalState },
  });

  const integrationGroups =
    integrationFieldGroupsProp?.length ? integrationFieldGroupsProp : loadedIntegrationGroups;
  const integrationValues = integrationFieldValuesProp ?? loadedIntegrationValues;
  const isActiveDirectoryDomain =
    (detectedApplicationCategory || applicationCategoryProp || "").trim() === "Active Directory Domain";
  const showIntegrationSection =
    isActiveDirectoryDomain ||
    (Boolean(showIntegrationAdvancedGroups || integrationFieldGroupsProp?.length) && integrationGroups.length > 0);

  const igaFieldsInTable = useMemo(
    () => new Set(inboundMappingRows.map((r) => r.igaField.trim().toLowerCase())),
    [inboundMappingRows]
  );
  const availableIgaFields = useMemo(
    () =>
      scimAttributes.filter((a) => {
        const key = a.trim().toLowerCase();
        return !igaFieldsInTable.has(key) && !integratedIgaSourceKeys.has(key);
      }),
    [scimAttributes, igaFieldsInTable, integratedIgaSourceKeys]
  );

  const filterIgaSource = (term: string) => {
    setInboundIgaField(term);
    if (!term.trim()) setFilteredIgaSource(availableIgaFields);
    else
      setFilteredIgaSource(
        availableIgaFields.filter((a) => a.toLowerCase().includes(term.toLowerCase()))
      );
  };

  const syncIgaDropdownPosition = useCallback(() => {
    if (igaSourceRef.current) {
      setIgaDropdownRect(igaSourceRef.current.getBoundingClientRect());
    }
  }, []);

  const openIgaSourceDropdown = useCallback(() => {
    setFilteredIgaSource(availableIgaFields);
    syncIgaDropdownPosition();
    setIgaSourceDropdownOpen(true);
  }, [availableIgaFields, syncIgaDropdownPosition]);

  useEffect(() => {
    if (!igaSourceDropdownOpen) return;
    syncIgaDropdownPosition();
    const onScrollOrResize = () => syncIgaDropdownPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [igaSourceDropdownOpen, syncIgaDropdownPosition]);

  useEffect(() => {
    if (!igaSourceDropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (igaSourceRef.current?.contains(target)) return;
      if (igaDropdownPortalRef.current?.contains(target)) return;
      setIgaSourceDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [igaSourceDropdownOpen]);

  const handleIntegrationFieldChange = (key: string, value: string) => {
    if (onIntegrationFieldChange) {
      onIntegrationFieldChange(key, value);
      return;
    }
    setLoadedIntegrationValues((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!showHooksThresholdAndTransformation) return;
    const controller = new AbortController();
    const schemaAppId =
      mappedSchemaApplicationId?.trim() ||
      (applicationId && applicationId !== "wizard" ? applicationId.trim() : "");

    (async () => {
      setInboundOptionsLoading(true);
      setInboundOptionsError(null);
      try {
        const scimHeaders = {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        };

        let applicationType = applicationCategoryProp?.trim() ?? "";
        if (!applicationType && schemaAppId) {
          try {
            const apiToken =
              typeof window !== "undefined"
                ? sessionStorage.getItem(`app-inventory-token-${schemaAppId}`) ?? ""
                : "";
            const appData = await getApplicationDetails(schemaAppId, apiToken);
            const app = appData?.Application ?? appData ?? {};
            applicationType = String(
              app.category ?? app.Category ?? app.applicationType ?? app.ApplicationType ?? ""
            ).trim();
          } catch {
            /* use empty — expressions fetch skipped until type is known */
          }
        }

        const expressionsUrl =
          schemaAppId && applicationType ? buildCelExpressionsUrl(schemaAppId, applicationType) : null;

        const mappedSchemaPromise = schemaAppId
          ? getMappedSchema("ACMECOM", schemaAppId).catch(() => null)
          : Promise.resolve(null);

        const expressionsPromise = expressionsUrl
          ? fetch(expressionsUrl, { signal: controller.signal })
          : Promise.resolve(null);

        const [exprRes, scimRes, mappedData] = await Promise.all([
          expressionsPromise,
          fetch(SCIM_ATTRIBUTES_URL, {
            method: "GET",
            headers: scimHeaders,
            signal: controller.signal,
          }),
          mappedSchemaPromise,
        ]);
        if (controller.signal.aborted) return;

        if (expressionsUrl) {
          if (!exprRes?.ok) throw new Error(`Expressions request failed (${exprRes.status})`);
        }
        if (!scimRes.ok) throw new Error(`SCIM attributes request failed (${scimRes.status})`);

        const scimData: unknown = await scimRes.json();
        const expressionOptions = expressionsUrl
          ? dedupeOptionsByName(parseCelExpressionsList(await exprRes!.json()))
          : [];

        const integratedKeys = mappedData
          ? integratedIgaSourceKeysFromMappedSchema(mappedData)
          : new Set<string>();
        const scimList = parseScimAttributesList(scimData);
        const available = scimList.filter((a) => !integratedKeys.has(a.trim().toLowerCase()));

        setIntegratedIgaSourceKeys(integratedKeys);
        setInboundTransformationProviderOptions(expressionOptions);
        setScimAttributes(scimList);
        setFilteredIgaSource(available);
        if (mappedData) {
          const { inbound, outbound } = transformationMappingsFromMappedSchema(mappedData);
          setInboundMappingRows(inbound);
          setOutboundMappingRows(outbound);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setInboundOptionsError(err instanceof Error ? err.message : "Failed to load dropdown options");
        setInboundTransformationProviderOptions([]);
        setScimAttributes([]);
        setIntegratedIgaSourceKeys(new Set());
        setFilteredIgaSource([]);
      } finally {
        if (!controller.signal.aborted) setInboundOptionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [applicationId, mappedSchemaApplicationId, applicationCategoryProp, showHooksThresholdAndTransformation]);

  useEffect(() => {
    if (!showHooksThresholdAndTransformation) return;
    const controller = new AbortController();
    (async () => {
      setOutboundOptionsLoading(true);
      setOutboundOptionsError(null);
      try {
        const res = await fetch(buildOutboundExpressionsUrl(), { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error(`Outbound expressions request failed (${res.status})`);
        const data: unknown = await res.json();
        setOutboundTransformationProviderOptions(dedupeOptionsByName(parseCelExpressionsList(data)));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOutboundOptionsError(err instanceof Error ? err.message : "Failed to load outbound providers");
        setOutboundTransformationProviderOptions([]);
      } finally {
        if (!controller.signal.aborted) setOutboundOptionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [showHooksThresholdAndTransformation]);

  const handleAddInboundMapping = () => {
    const iga = inboundIgaField.trim();
    const provider = inboundTransformationProvider.trim();
    if (!iga || !provider) return;
    setInboundMappingRows((prev) => [
      ...prev,
      { id: `inbound-${Date.now()}`, igaField: iga, transformationProvider: provider },
    ]);
    setInboundIgaField("");
    setInboundTransformationProvider("");
  };

  const removeInboundMapping = (id: string) => {
    setInboundMappingRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddOutboundMapping = () => {
    const target = outboundTargetField.trim();
    const provider = outboundTransformationProvider.trim();
    if (!target || !provider) return;
    setOutboundMappingRows((prev) => [
      ...prev,
      { id: `outbound-${Date.now()}`, targetField: target, transformationProvider: provider },
    ]);
    setOutboundTargetField("");
    setOutboundTransformationProvider("");
  };

  const removeOutboundMapping = (id: string) => {
    setOutboundMappingRows((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    if (integrationFieldGroupsProp?.length || !showIntegrationAdvancedGroups) return;
    if (!applicationId || applicationId === "wizard") return;

    let cancelled = false;
    (async () => {
      setIntegrationGroupsLoading(true);
      try {
        const apiToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem(`app-inventory-token-${applicationId}`) ?? ""
            : "";
        const [appData, supported] = await Promise.all([
          getApplicationDetails(applicationId, apiToken),
          getAllSupportedApplicationTypesViaProxy(),
        ]);
        if (cancelled) return;

        const app = appData?.Application ?? appData ?? {};
        const category =
          applicationCategoryProp?.trim() ||
          String(app.category ?? app.Category ?? app.applicationType ?? "").trim();
        setDetectedApplicationCategory(category);

        const conn = (app.connectionDetails ?? app.ConnectionDetails ?? {}) as Record<string, unknown>;
        const values: Record<string, string> = {};
        Object.entries(conn).forEach(([k, v]) => {
          if (v != null && typeof v !== "object") values[k] = String(v);
        });
        setLoadedIntegrationValues(values);

        const parsedConfig = parseSavedApplicationConfig(app);
        setHookName(parsedConfig?.hookName ?? "");
        setServiceRowsByEventTab(
          parsedConfig?.serviceRowsByEventTab ?? { "pre-process": [], "post-process": [] }
        );
        setSdkRowsByEventTab(parsedConfig?.sdkRowsByEventTab ?? { "pre-process": [], "post-process": [] });
        setThresholdByOperation({
          disable: { ...initialThresholdState, ...parsedConfig?.thresholdByOperation?.disable },
          create: { ...initialThresholdState, ...parsedConfig?.thresholdByOperation?.create },
          delete: { ...initialThresholdState, ...parsedConfig?.thresholdByOperation?.delete },
        });
        setExceptionalByOperation({
          disable: { ...initialExceptionalState, ...parsedConfig?.exceptionalByOperation?.disable },
          create: { ...initialExceptionalState, ...parsedConfig?.exceptionalByOperation?.create },
          delete: { ...initialExceptionalState, ...parsedConfig?.exceptionalByOperation?.delete },
        });

        let groups: ApplicationTypeIntegrationFieldGroup[] = [];
        if (category && supported?.applicationType && Array.isArray(supported.applicationType)) {
          for (const raw of supported.applicationType as unknown[]) {
            const parsed = parseSupportedObjectsApplicationTypeItem(raw);
            if (parsed?.typeName === category && parsed.integrationFieldGroups?.length) {
              groups = parsed.integrationFieldGroups;
              break;
            }
          }
        }
        setLoadedIntegrationGroups(groups);
      } catch {
        if (!cancelled) {
          setLoadedIntegrationGroups([]);
          setLoadedIntegrationValues({});
        }
      } finally {
        if (!cancelled) setIntegrationGroupsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applicationId,
    applicationCategoryProp,
    integrationFieldGroupsProp,
    showIntegrationAdvancedGroups,
  ]);

  const setThreshold = (op: ThresholdOp, update: Partial<ThresholdState>) => {
    setThresholdByOperation((prev) => ({ ...prev, [op]: { ...prev[op], ...update } }));
  };
  const setExceptional = (op: ThresholdOp, update: Partial<ExceptionalState>) => {
    setExceptionalByOperation((prev) => ({ ...prev, [op]: { ...prev[op], ...update } }));
  };
  const addPeakDayRange = (op: ThresholdOp) => {
    setExceptionalByOperation((prev) => ({
      ...prev,
      [op]: {
        ...prev[op],
        peakDays: [...prev[op].peakDays, { id: `peak-${Date.now()}`, startDate: "", endDate: "" }],
      },
    }));
  };
  const removePeakDayRange = (op: ThresholdOp, id: string) => {
    setExceptionalByOperation((prev) => ({
      ...prev,
      [op]: { ...prev[op], peakDays: prev[op].peakDays.filter((r) => r.id !== id) },
    }));
  };
  const updatePeakDayRange = (op: ThresholdOp, id: string, field: "startDate" | "endDate", value: string) => {
    setExceptionalByOperation((prev) => ({
      ...prev,
      [op]: {
        ...prev[op],
        peakDays: prev[op].peakDays.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
      },
    }));
  };
  const addPeakTimeRange = (op: ThresholdOp) => {
    setExceptionalByOperation((prev) => ({
      ...prev,
      [op]: {
        ...prev[op],
        peakTimes: [...prev[op].peakTimes, { id: `peak-time-${Date.now()}`, startDate: "", endDate: "" }],
      },
    }));
  };
  const removePeakTimeRange = (op: ThresholdOp, id: string) => {
    setExceptionalByOperation((prev) => ({
      ...prev,
      [op]: { ...prev[op], peakTimes: prev[op].peakTimes.filter((r) => r.id !== id) },
    }));
  };
  const updatePeakTimeRange = (op: ThresholdOp, id: string, field: "startDate" | "endDate", value: string) => {
    setExceptionalByOperation((prev) => ({
      ...prev,
      [op]: {
        ...prev[op],
        peakTimes: prev[op].peakTimes.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
      },
    }));
  };

  const buildApplicationConfig = (): Record<string, unknown> => {
    const preProcessEvent: unknown[] = [];
    (serviceRowsByEventTab["pre-process"] || []).forEach((r) => {
      preProcessEvent.push({
        type: "service",
        endpoint: r.endpoint,
        authorization: r.authorization,
        operation: r.operation,
        isEnabled: r.isEnabled,
        customHeaders: r.customHeaders,
      });
    });
    (sdkRowsByEventTab["pre-process"] || []).forEach((r) => {
      preProcessEvent.push({
        type: "sdk",
        implementationClass: r.implementationClass,
        agentId: r.agentId,
        operation: r.operation,
        isEnabled: r.isEnabled,
      });
    });

    const postProcessEvent: unknown[] = [];
    (serviceRowsByEventTab["post-process"] || []).forEach((r) => {
      postProcessEvent.push({
        type: "service",
        endpoint: r.endpoint,
        authorization: r.authorization,
        operation: r.operation,
        isEnabled: r.isEnabled,
        customHeaders: r.customHeaders,
      });
    });
    (sdkRowsByEventTab["post-process"] || []).forEach((r) => {
      postProcessEvent.push({
        type: "sdk",
        implementationClass: r.implementationClass,
        agentId: r.agentId,
        operation: r.operation,
        isEnabled: r.isEnabled,
      });
    });

    const threshold: unknown[] = (
      ["disable", "create", "delete"] as ThresholdOp[]
    ).map((op) => {
      const th = thresholdByOperation[op];
      const exc = exceptionalByOperation[op];
      const operationLabel =
        op === "disable" ? "Disable" : op === "create" ? "Create" : "Delete";
      return {
        operation: operationLabel,
        cutOff: {
          maximumAllowed: th.maxLimit,
          stopFurtherOperations: th.action === "stop",
          sendAlertTo: th.email || "",
          durationInMinutes: th.minutes || 0,
        },
        exceptionalCases: {
          peakDays: exc.peakDays.map((r) => ({
            startDate: r.startDate || "",
            endData: r.endDate || "",
          })),
          peakTime: exc.peakTimes.map((r) => ({
            startTime: r.startDate || "",
            endTime: r.endDate || "",
          })),
        },
      };
    });

    return {
      hook: {
        name: hookName || "",
        postProcessEvent,
        preProcessEvent,
      },
      threshold,
      appAccessRule: [{ ...defaultAppAccessRule }],
      autoRetry: { ...defaultAutoRetry },
    };
  };

  const buildApplicationConfigRef = useRef(buildApplicationConfig);
  buildApplicationConfigRef.current = buildApplicationConfig;
  useImperativeHandle(
    ref,
    () => ({
      getConfig: () => buildApplicationConfigRef.current(),
    }),
    []
  );

  const resolveSchemaAppId = () =>
    mappedSchemaApplicationId?.trim() ||
    (applicationId && applicationId !== "wizard" ? applicationId.trim() : "");

  const handleSaveTransformationMappings = async () => {
    const appId = resolveSchemaAppId();
    setTransformationSaveError(null);
    setTransformationSaveSuccess(false);

    if (!appId) {
      setTransformationSaveError("Save is available after the application is registered.");
      return;
    }

    setIsTransformationSaving(true);
    try {
      const existingMapped = await getMappedSchema("ACMECOM", appId);
      const payload = buildMapFieldsPayloadWithTransformations(
        existingMapped,
        inboundMappingRows,
        outboundMappingRows
      );
      await mapSchemaFields("ACMECOM", appId, payload);
      const refreshed = await getMappedSchema("ACMECOM", appId);
      const { inbound, outbound } = transformationMappingsFromMappedSchema(refreshed);
      setInboundMappingRows(inbound);
      setOutboundMappingRows(outbound);
      setIntegratedIgaSourceKeys(integratedIgaSourceKeysFromMappedSchema(refreshed));
      setTransformationSaveSuccess(true);
    } catch (err) {
      setTransformationSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsTransformationSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!applicationId || wizardMode) return;
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);
    try {
      const oldApiToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`app-inventory-token-${applicationId}`) ?? ""
          : "";
      const applicationConfig = buildApplicationConfig();
      await updateAppConfig(applicationId, oldApiToken, applicationConfig);
      setSubmitSuccess(true);
      router.push("/settings/app-inventory");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/settings/app-inventory");
    }
  };

  const operationLabel = (op: string) =>
    op === "getuser" ? "GetUser" : op === "getalluser" ? "GetAllUser" : op.charAt(0).toUpperCase() + op.slice(1);

  const openProcessEventModal = () => {
    const op = tabState.activeOperation;
    setProcessEventForm({
      endpoint: "",
      authorization: "",
      operation: operationLabel(op),
      isEnabled: false,
    });
    setCustomHeaders([]);
    setIsProcessEventModalOpen(true);
  };
  const closeProcessEventModal = () => setIsProcessEventModalOpen(false);
  const addCustomHeader = () => setCustomHeaders((prev) => [...prev, { name: "", value: "" }]);
  const removeCustomHeader = (index: number) =>
    setCustomHeaders((prev) => prev.filter((_, i) => i !== index));
  const updateCustomHeader = (index: number, field: "name" | "value", value: string) =>
    setCustomHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  const isProcessEventFormValid =
    processEventForm.endpoint.trim() !== "" && processEventForm.authorization.trim() !== "";

  const addServiceRow = () => {
    const row: ServiceRow = {
      id: `service-${Date.now()}`,
      endpoint: processEventForm.endpoint,
      authorization: processEventForm.authorization,
      operation: processEventForm.operation,
      isEnabled: processEventForm.isEnabled,
      customHeaders: customHeaders.filter((h) => h.name.trim() || h.value.trim()),
    };
    setServiceRowsByEventTab((prev) => ({
      ...prev,
      [activeEventTab]: [...(prev[activeEventTab] || []), row],
    }));
    closeProcessEventModal();
  };

  const removeServiceRow = (eventTab: EventTabId, id: string) => {
    setServiceRowsByEventTab((prev) => ({
      ...prev,
      [eventTab]: (prev[eventTab] || []).filter((r) => r.id !== id),
    }));
  };

  const openSdkModal = () => {
    const op = tabState.activeSDKOperation;
    setSdkForm({
      implementationClass: "",
      agentId: "",
      operation: operationLabel(op),
      isEnabled: false,
    });
    setIsSdkModalOpen(true);
  };
  const closeSdkModal = () => setIsSdkModalOpen(false);
  const isSdkFormValid =
    sdkForm.implementationClass.trim() !== "" && sdkForm.agentId.trim() !== "";

  const addSdkRow = () => {
    const row: SdkRow = {
      id: `sdk-${Date.now()}`,
      implementationClass: sdkForm.implementationClass,
      agentId: sdkForm.agentId,
      operation: sdkForm.operation,
      isEnabled: sdkForm.isEnabled,
    };
    setSdkRowsByEventTab((prev) => ({
      ...prev,
      [activeEventTab]: [...(prev[activeEventTab] || []), row],
    }));
    closeSdkModal();
  };

  const removeSdkRow = (eventTab: EventTabId, id: string) => {
    setSdkRowsByEventTab((prev) => ({
      ...prev,
      [eventTab]: (prev[eventTab] || []).filter((r) => r.id !== id),
    }));
  };

  const tabState = eventTabState[activeEventTab];
  const setTabState = (update: Partial<typeof initialEventTabState>) => {
    setEventTabState((prev) => ({
      ...prev,
      [activeEventTab]: { ...prev[activeEventTab], ...update },
    }));
  };

  const adBoolValue = (key: string, fallback: boolean): boolean => {
    const v = integrationValues[key];
    return v === undefined ? fallback : v === "true";
  };

  const renderAdTextField = (key: string, label: string) => (
    <div className="flex-1 relative">
      <input
        type="text"
        value={integrationValues[key] ?? ""}
        onChange={(e) => handleIntegrationFieldChange(key, e.target.value)}
        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
        placeholder=" "
      />
      <label
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
          integrationValues[key] ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
        }`}
      >
        {label}
      </label>
    </div>
  );

  const renderActiveDirectoryDomainAdvanced = () => (
    <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60 shadow-sm">
      <button
        type="button"
        onClick={() => setAdDomainAdvancedExpanded((e) => !e)}
        aria-expanded={adDomainAdvancedExpanded}
        className="flex w-full items-center justify-between gap-2 border-l-4 border-slate-400 bg-white px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 text-slate-700">
            <Settings2 className="w-4 h-4" aria-hidden />
          </span>
          Advanced
        </h3>
        {adDomainAdvancedExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" aria-hidden />
        ) : (
          <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" aria-hidden />
        )}
      </button>
      {adDomainAdvancedExpanded && (
        <div className="p-5 border-t border-slate-200 bg-white space-y-4">
          <div className="flex items-center gap-3">
            {renderAdTextField("primaryDomainController", "Domain Controller")}
            <div className="flex-1 relative">
              <select
                value={integrationValues.portSsl ?? ""}
                onChange={(e) => handleIntegrationFieldChange("portSsl", e.target.value)}
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline appearance-none bg-white"
              >
                <option value=""></option>
                <option value="389 - LDAP">389 - LDAP</option>
                <option value="636 - LDAPS">636 - LDAPS</option>
              </select>
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  integrationValues.portSsl ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Port / SSL
              </label>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <select
                value={integrationValues.vault ?? ""}
                onChange={(e) => handleIntegrationFieldChange("vault", e.target.value)}
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline appearance-none bg-white"
              >
                <option value=""></option>
                <option value="DPW-Dubai-CyberArk">DPW-Dubai-CyberArk</option>
                <option value="US-AD-OCI-Vault">US-AD-OCI-Vault</option>
                <option value="NA-Shared-CyberArk">NA-Shared-CyberArk</option>
                <option value="UK-HashiCorp-Vault">UK-HashiCorp-Vault</option>
              </select>
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  integrationValues.vault ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                }`}
              >
                Vault
              </label>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden />
            </div>
            {renderAdTextField("secretPath", "Secret Path")}
          </div>
          <div className="flex items-center gap-3">
            {renderAdTextField("userSearchBase", "User Search Base")}
            {renderAdTextField("groupSearchBase", "Group Search Base")}
          </div>
          <div className="flex items-center gap-3">
            {renderAdTextField("deletedOu", "Deleted OU")}
            {renderAdTextField("contactOu", "Contact OU")}
          </div>
          <div className="flex items-center gap-3">
            {renderAdTextField("vaultName", "Vault Name")}
            {renderAdTextField("vaultPath", "Vault Path")}
          </div>

          <div style={{ paddingTop: 8, marginTop: 8, borderTop: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Inherited Global Policies</h4>
                {[
                  { label: "Email uniqueness", border: "#93c5fd", text: "#2563eb", bg: "#eff6ff" },
                  { label: "SAMaccount", border: "#d8b4fe", text: "#9333ea", bg: "#faf5ff" },
                  { label: "UPN", border: "#6ee7b7", text: "#059669", bg: "#ecfdf5" },
                ].map(({ label, border, text, bg }) => (
                  <span
                    key={label}
                    title="Inherited from global validations — cannot be edited here"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      border: `1px solid ${border}`,
                      color: text,
                      background: bg,
                      cursor: "not-allowed",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setInheritedPoliciesEditing((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: inheritedPoliciesEditing ? "#2563eb" : "#fff",
                  color: inheritedPoliciesEditing ? "#fff" : "#374151",
                  border: inheritedPoliciesEditing ? "1px solid #2563eb" : "1px solid #d1d5db",
                }}
              >
                {inheritedPoliciesEditing ? (
                  <>
                    <Check style={{ width: 14, height: 14 }} aria-hidden />
                    Save
                  </>
                ) : (
                  <>
                    <Edit style={{ width: 14, height: 14 }} aria-hidden />
                    Edit
                  </>
                )}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px" }}>
                <span style={{ fontSize: 14, color: "#4b5563" }}>Port</span>
                <input
                  type="text"
                  value={integrationValues.inheritedPort ?? "636"}
                  onChange={(e) => handleIntegrationFieldChange("inheritedPort", e.target.value)}
                  disabled={!inheritedPoliciesEditing}
                  style={{
                    width: 80,
                    textAlign: "right",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: "#111827",
                    background: inheritedPoliciesEditing ? "#fff" : "transparent",
                    border: inheritedPoliciesEditing ? "1px solid #d1d5db" : "1px solid transparent",
                    cursor: inheritedPoliciesEditing ? "text" : "not-allowed",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px" }}>
                <span style={{ fontSize: 14, color: "#4b5563" }}>SSL enabled</span>
                <ToggleSwitch
                  checked={adBoolValue("inheritedSslEnabled", true)}
                  onChange={(v) => handleIntegrationFieldChange("inheritedSslEnabled", v ? "true" : "false")}
                  disabled={!inheritedPoliciesEditing}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px" }}>
                <span style={{ fontSize: 14, color: "#4b5563" }}>Delete account on delete request</span>
                <ToggleSwitch
                  checked={adBoolValue("inheritedDeleteAcctOnDeleteRequest", false)}
                  onChange={(v) => handleIntegrationFieldChange("inheritedDeleteAcctOnDeleteRequest", v ? "true" : "false")}
                  disabled={!inheritedPoliciesEditing}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px" }}>
                <span style={{ fontSize: 14, color: "#4b5563" }}>Revoke membership</span>
                <ToggleSwitch
                  checked={adBoolValue("inheritedRevokeMembership", true)}
                  onChange={(v) => handleIntegrationFieldChange("inheritedRevokeMembership", v ? "true" : "false")}
                  disabled={!inheritedPoliciesEditing}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px", gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 14, color: "#4b5563" }}>Primary Identity Attribute</span>
                <input
                  type="text"
                  value={integrationValues.inheritedPrimaryIdentityAttribute ?? "samaccountname"}
                  onChange={(e) => handleIntegrationFieldChange("inheritedPrimaryIdentityAttribute", e.target.value)}
                  disabled={!inheritedPoliciesEditing}
                  style={{
                    width: 192,
                    textAlign: "right",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: "#111827",
                    background: inheritedPoliciesEditing ? "#fff" : "transparent",
                    border: inheritedPoliciesEditing ? "1px solid #d1d5db" : "1px solid transparent",
                    cursor: inheritedPoliciesEditing ? "text" : "not-allowed",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const visibleSections: AdvancedSectionId[] = [
    ...(showIntegrationSection ? (["connection"] as const) : []),
    ...(showHooksThresholdAndTransformation ? (["transformation", "hooks", "threshold"] as const) : []),
  ];
  // Always land on whichever tab is actually first in the strip, even if Connection
  // Parameters' data (async) wasn't ready yet on the very first render.
  useEffect(() => {
    if (didInitAdvancedSection.current || visibleSections.length === 0) return;
    didInitAdvancedSection.current = true;
    setActiveAdvancedSection(visibleSections[0]);
  }, [visibleSections]);
  // Content below Hooks/Threshold headers still gates on these; now derived from the active tab
  // instead of independent collapse state, since the whole card is already tab-gated.
  const isHooksExpanded = activeAdvancedSection === "hooks";
  const isThresholdExpanded = activeAdvancedSection === "threshold";

  return (
    <div className="p-6">
          {visibleSections.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-6 w-fit">
              {visibleSections.map((id) => {
                const meta = ADVANCED_SECTION_META[id];
                const isActive = activeAdvancedSection === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveAdvancedSection(id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? meta.active : meta.idle
                    }`}
                  >
                    <meta.icon className={`w-4 h-4 ${isActive ? meta.iconActive : meta.iconIdle}`} aria-hidden />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          )}
          {integrationGroupsLoading && showIntegrationAdvancedGroups && !integrationFieldGroupsProp?.length ? (
            <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Loading integration advanced settings...
            </div>
          ) : null}
          {showIntegrationSection && activeAdvancedSection === "connection" ? (
            isActiveDirectoryDomain ? (
              renderActiveDirectoryDomainAdvanced()
            ) : (
              <IntegrationAdvancedSettingGroups
                className="mb-6"
                groups={integrationGroups}
                values={integrationValues}
                onChange={handleIntegrationFieldChange}
                expandStateKeyPrefix={applicationId || "app"}
                sectionTitle=""
              />
            )
          ) : null}
          {showHooksThresholdAndTransformation && (
            <>
          {/* Transformation Provider */}
          {activeAdvancedSection === "transformation" && (
          <div className="mb-6 border border-slate-200 rounded-xl overflow-visible bg-slate-50/60 shadow-sm">
            <div
              className="flex items-center gap-2 border-l-4 border-violet-500 bg-white px-5 py-3.5"
            >
              <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-700">
                  <Workflow className="w-4 h-4" aria-hidden />
                </span>
                Transformation Provider
              </h3>
            </div>
            <div className="p-5 border-t border-slate-200 bg-white flex flex-col gap-3">
                <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-visible">
                  <button
                    type="button"
                    onClick={() => setIsInboundTransformationExpanded((v) => !v)}
                    className={`flex w-full items-start justify-between gap-4 px-4 py-4 text-left bg-sky-50 hover:bg-sky-100/70 transition-colors ${
                      isInboundTransformationExpanded ? "border-b border-sky-100" : ""
                    }`}
                    aria-expanded={isInboundTransformationExpanded}
                  >
                    <div className="flex flex-1 flex-col gap-1 min-w-0 pr-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-100 text-sky-700 shrink-0">
                          <LogIn className="w-3.5 h-3.5" aria-hidden />
                        </span>
                        InBound Transformation
                      </span>
                      <p className="text-xs text-gray-600 leading-relaxed pl-8">
                        Inbound transformation happens when data is coming into the IGA system from a target
                        application (HR system, Active Directory, database, cloud app, etc.).
                      </p>
                    </div>
                    {isInboundTransformationExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" aria-hidden />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" aria-hidden />
                    )}
                  </button>
                  {isInboundTransformationExpanded && (
                    <div className="px-4 py-4 bg-white space-y-4">
                      {inboundOptionsError && (
                        <p className="text-xs text-red-600" role="alert">
                          {inboundOptionsError}
                        </p>
                      )}
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[12rem] relative overflow-visible" ref={igaSourceRef}>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            IGA Field
                          </label>
                          <input
                            type="text"
                            value={inboundIgaField}
                            onChange={(e) => filterIgaSource(e.target.value)}
                            onFocus={openIgaSourceDropdown}
                            disabled={inboundOptionsLoading}
                            placeholder={
                              inboundOptionsLoading
                                ? "Loading..."
                                : "Select or enter source attribute"
                            }
                            className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          <button
                            type="button"
                            disabled={inboundOptionsLoading}
                            className="absolute right-2 top-[1.85rem] text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (igaSourceDropdownOpen) {
                                setIgaSourceDropdownOpen(false);
                              } else {
                                openIgaSourceDropdown();
                              }
                            }}
                            aria-label="Toggle IGA field list"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${igaSourceDropdownOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {igaSourceDropdownOpen &&
                            !inboundOptionsLoading &&
                            igaDropdownRect &&
                            typeof document !== "undefined" &&
                            createPortal(
                              <div
                                ref={igaDropdownPortalRef}
                                className="fixed z-[200] bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                                style={{
                                  top: igaDropdownRect.bottom + 4,
                                  left: igaDropdownRect.left,
                                  width: igaDropdownRect.width,
                                }}
                              >
                                {filteredIgaSource.length === 0 ? (
                                  <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
                                ) : (
                                  filteredIgaSource.map((attr, index) => (
                                    <button
                                      key={`${attr}-${index}`}
                                      type="button"
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setInboundIgaField(attr);
                                        setIgaSourceDropdownOpen(false);
                                      }}
                                    >
                                      {attr}
                                    </button>
                                  ))
                                )}
                              </div>,
                              document.body
                            )}
                        </div>
                        <div className="flex-1 min-w-[12rem]">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Transformation Provider
                          </label>
                          <select
                            value={inboundTransformationProvider}
                            onChange={(e) => setInboundTransformationProvider(e.target.value)}
                            disabled={inboundOptionsLoading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">
                              {inboundOptionsLoading
                                ? "Loading..."
                                : "Select transformation provider"}
                            </option>
                            {inboundTransformationProviderOptions.map((opt) => (
                              <option key={`transform-${opt.id}-${opt.name}`} value={opt.name}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={handleAddInboundMapping}
                            disabled={
                              inboundOptionsLoading ||
                              !inboundIgaField.trim() ||
                              !inboundTransformationProvider.trim()
                            }
                            className="h-[38px] px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      {inboundMappingRows.length > 0 && (
                        <div className="border border-slate-200 rounded-md overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs font-medium text-slate-600 uppercase tracking-wide">
                              <tr>
                                <th className="px-3 py-2">IGA Field</th>
                                <th className="px-3 py-2">Transformation Provider</th>
                                <th className="px-3 py-2 w-16" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {inboundMappingRows.map((row) => (
                                <tr key={row.id} className="bg-white">
                                  <td className="px-3 py-2 text-slate-800">{row.igaField}</td>
                                  <td className="px-3 py-2 text-slate-800">
                                    {row.transformationProvider}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => removeInboundMapping(row.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                      aria-label="Remove mapping"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-visible">
                  <button
                    type="button"
                    onClick={() => setIsOutboundTransformationExpanded((v) => !v)}
                    className={`flex w-full items-start justify-between gap-4 px-4 py-4 text-left bg-emerald-50 hover:bg-emerald-100/70 transition-colors ${
                      isOutboundTransformationExpanded ? "border-b border-emerald-100" : ""
                    }`}
                    aria-expanded={isOutboundTransformationExpanded}
                  >
                    <div className="flex flex-1 flex-col gap-1 min-w-0 pr-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 shrink-0">
                          <LogOut className="w-3.5 h-3.5" aria-hidden />
                        </span>
                        OutBound Transformation
                      </span>
                      <p className="text-xs text-gray-600 leading-relaxed pl-8">
                        Outbound transformation occurs when data moves from IGA to a target application during
                        provisioning or updates.
                      </p>
                    </div>
                    {isOutboundTransformationExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" aria-hidden />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" aria-hidden />
                    )}
                  </button>
                  {isOutboundTransformationExpanded && (
                    <div className="px-4 py-4 bg-white space-y-4">
                      {outboundOptionsError && (
                        <p className="text-xs text-red-600" role="alert">
                          {outboundOptionsError}
                        </p>
                      )}
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[12rem]">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Target Field
                          </label>
                          <input
                            type="text"
                            value={outboundTargetField}
                            onChange={(e) => setOutboundTargetField(e.target.value)}
                            disabled={outboundOptionsLoading}
                            placeholder={
                              outboundOptionsLoading ? "Loading..." : "Enter target field"
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div className="flex-1 min-w-[12rem]">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Transformation Provider
                          </label>
                          <select
                            value={outboundTransformationProvider}
                            onChange={(e) => setOutboundTransformationProvider(e.target.value)}
                            disabled={outboundOptionsLoading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">
                              {outboundOptionsLoading
                                ? "Loading..."
                                : "Select transformation provider"}
                            </option>
                            {outboundTransformationProviderOptions.map((opt) => (
                              <option key={`outbound-transform-${opt.id}-${opt.name}`} value={opt.name}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={handleAddOutboundMapping}
                            disabled={
                              outboundOptionsLoading ||
                              !outboundTargetField.trim() ||
                              !outboundTransformationProvider.trim()
                            }
                            className="h-[38px] px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      {outboundMappingRows.length > 0 && (
                        <div className="border border-slate-200 rounded-md overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs font-medium text-slate-600 uppercase tracking-wide">
                              <tr>
                                <th className="px-3 py-2">Target Field</th>
                                <th className="px-3 py-2">Transformation Provider</th>
                                <th className="px-3 py-2 w-16" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {outboundMappingRows.map((row) => (
                                <tr key={row.id} className="bg-white">
                                  <td className="px-3 py-2 text-slate-800">{row.targetField}</td>
                                  <td className="px-3 py-2 text-slate-800">
                                    {row.transformationProvider}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => removeOutboundMapping(row.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                      aria-label="Remove mapping"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 pt-4 mt-1 border-t border-slate-200">
                  {transformationSaveError && (
                    <p className="text-xs text-red-600 w-full text-right" role="alert">
                      {transformationSaveError}
                    </p>
                  )}
                  {transformationSaveSuccess && (
                    <p className="text-xs text-green-600 w-full text-right" role="status">
                      Transformation mappings saved successfully.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveTransformationMappings}
                    disabled={isTransformationSaving}
                    className="h-[38px] px-5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTransformationSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
          </div>
          )}


          {/* Hooks section */}
          {activeAdvancedSection === "hooks" && (
          <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60 shadow-sm">
            <div className="flex items-center gap-2 border-l-4 border-indigo-500 bg-white px-5 py-3.5">
              <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700">
                  <Webhook className="w-4 h-4" aria-hidden />
                </span>
                Hooks
              </h3>
            </div>
            {isHooksExpanded && (
            <div className="p-5 space-y-4 border-t border-slate-200 bg-white">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <div className="relative">
                  <Webhook className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" aria-hidden />
                  <input
                    type="text"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    placeholder="Enter hook name"
                    value={hookName}
                    onChange={(e) => setHookName(e.target.value)}
                  />
                </div>
              </div>

              {/* Pre / Post Process Event - card */}
              <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
            {/* Event Tabs: Pre Process Event | Post Process Event */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeEventTab === "pre-process"
                      ? "bg-white shadow-sm text-indigo-700"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setActiveEventTab("pre-process")}
                >
                  Pre Process Event
                </button>
                <button
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeEventTab === "post-process"
                      ? "bg-white shadow-sm text-indigo-700"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setActiveEventTab("post-process")}
                >
                  Post Process Event
                </button>
              </div>
            </div>

            {/* Service (SDK hidden via SHOW_SDK_SECTION flag) are part of the selected event tab */}
            <div className="p-5">
            {/* Service Section */}
            <div className="space-y-4">
              <div
                className="flex items-center justify-between cursor-pointer bg-indigo-50 hover:bg-indigo-100/70 transition-colors p-3 rounded-lg"
                onClick={() => setTabState({ isServiceExpanded: !tabState.isServiceExpanded })}
              >
                <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-100 text-indigo-700">
                    <ListChecks className="w-4 h-4" aria-hidden />
                  </span>
                  Service
                </h3>
                {tabState.isServiceExpanded ? (
                  <ChevronDown className="w-5 h-5 text-indigo-500" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-indigo-500" />
                )}
              </div>

              {tabState.isServiceExpanded && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tabState.activeOperation === "create"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setTabState({ activeOperation: "create" })}
                    >
                      Create
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tabState.activeOperation === "update"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setTabState({ activeOperation: "update" })}
                    >
                      Update
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tabState.activeOperation === "delete"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setTabState({ activeOperation: "delete" })}
                    >
                      Delete
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tabState.activeOperation === "getuser"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setTabState({ activeOperation: "getuser" })}
                    >
                      GetUser
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tabState.activeOperation === "getalluser"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setTabState({ activeOperation: "getalluser" })}
                    >
                      GetAllUser
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Endpoint
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Authorization
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Operation
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {(() => {
                          const rowsForOperation = (serviceRowsByEventTab[activeEventTab] || []).filter(
                            (r) => r.operation === operationLabel(tabState.activeOperation)
                          );
                          return rowsForOperation.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                              <div className="flex flex-col items-center gap-1.5">
                                <ListChecks className="w-5 h-5 text-slate-300" aria-hidden />
                                No {operationLabel(tabState.activeOperation)} services configured yet.
                              </div>
                            </td>
                          </tr>
                        ) : (
                          rowsForOperation.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-slate-900">{row.endpoint}</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{row.authorization}</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{row.operation}</td>
                              <td className="px-4 py-3 text-sm text-slate-500">
                                <div className="flex items-center gap-3">
                                  <button type="button" className="text-indigo-600 hover:text-indigo-800">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeServiceRow(activeEventTab, row.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={openProcessEventModal}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" aria-hidden />
                      Add Service
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50" aria-label="Previous page">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center text-sm font-medium bg-indigo-600 text-white rounded-lg">
                        1
                      </button>
                      <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50" aria-label="Next page">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {SHOW_SDK_SECTION && (
              <>
                {/* SDK Section */}
                <div className="space-y-4 mt-8">
                  <div
                    className="flex items-center justify-between cursor-pointer bg-blue-50 hover:bg-blue-100 p-2 rounded"
                    onClick={() => setTabState({ isSDKExpanded: !tabState.isSDKExpanded })}
                  >
                    <h3 className="text-md font-semibold text-gray-800 flex items-center">
                      <svg
                        className="w-5 h-5 text-gray-600 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z" />
                      </svg>
                      SDK
                    </h3>
                    {tabState.isSDKExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {tabState.isSDKExpanded && (
                    <>
                      <div className="flex space-x-2 mb-4">
                        <button
                          className={`px-4 py-2 text-sm font-medium rounded ${
                            tabState.activeSDKOperation === "create"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => setTabState({ activeSDKOperation: "create" })}
                        >
                          Create
                        </button>
                        <button
                          className={`px-4 py-2 text-sm font-medium rounded ${
                            tabState.activeSDKOperation === "update"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => setTabState({ activeSDKOperation: "update" })}
                        >
                          Update
                        </button>
                        <button
                          className={`px-4 py-2 text-sm font-medium rounded ${
                            tabState.activeSDKOperation === "delete"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => setTabState({ activeSDKOperation: "delete" })}
                        >
                          Delete
                        </button>
                        <button
                          className={`px-4 py-2 text-sm font-medium rounded ${
                            tabState.activeSDKOperation === "getuser"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => setTabState({ activeSDKOperation: "getuser" })}
                        >
                          GetUser
                        </button>
                        <button
                          className={`px-4 py-2 text-sm font-medium rounded ${
                            tabState.activeSDKOperation === "getalluser"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => setTabState({ activeSDKOperation: "getalluser" })}
                        >
                          GetAllUser
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Implementation Class
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Agent Id
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Operation
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(() => {
                              const sdkRowsForOperation = (sdkRowsByEventTab[activeEventTab] || []).filter(
                                (r) => r.operation === operationLabel(tabState.activeSDKOperation)
                              );
                              return sdkRowsForOperation.length === 0 ? (
                                <tr>
                                  <td className="px-4 py-3 text-sm text-gray-500">-</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">-</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">-</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    <div className="flex space-x-2">
                                      <button type="button" className="text-gray-400 cursor-default" disabled>
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button type="button" className="text-gray-400 cursor-default" disabled>
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                sdkRowsForOperation.map((row) => (
                                  <tr key={row.id}>
                                    <td className="px-4 py-3 text-sm text-gray-900">{row.implementationClass}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{row.agentId}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{row.operation}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                      <div className="flex space-x-2">
                                        <button type="button" className="text-blue-600 hover:text-blue-800">
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeSdkRow(activeEventTab, row.id)}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={openSdkModal}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                        >
                          Add SDK
                        </button>
                        <div className="flex items-center space-x-2">
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
                            &lt;
                          </button>
                          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
                            1
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
                            &gt;
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          </div>
          </div>
            )}
          </div>
          )}

          {/* Target System Provisioning Threshold */}
          {activeAdvancedSection === "threshold" && (
          <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60 shadow-sm">
            <div className="flex items-center gap-2 border-l-4 border-amber-500 bg-white px-5 py-3.5">
              <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-700">
                  <Gauge className="w-4 h-4" aria-hidden />
                </span>
                Target System Provisioning Threshold
              </h3>
            </div>

            {isThresholdExpanded && (
              <div className="p-5 space-y-5 border-t border-slate-200 bg-white">
                {(["disable", "create", "delete"] as ThresholdOp[]).map((op) => {
                  const th = thresholdByOperation[op];
                  const exc = exceptionalByOperation[op];
                  const opLabel = op.charAt(0).toUpperCase() + op.slice(1);
                  const showExceptional = th.maxLimit > 0;
                  const opMeta = THRESHOLD_OP_META[op];
                  return (
                    <div
                      key={op}
                      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${opMeta.border}`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md ${opMeta.iconBadge}`}>
                          <opMeta.icon className="w-3.5 h-3.5" aria-hidden />
                        </span>
                        <span className={`text-xs font-semibold uppercase tracking-wide ${opMeta.eyebrow}`}>
                          {opLabel} Operation
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>If the {opLabel} Operation exceeds the maximum limit of</span>
                        <input
                          type="number"
                          className={`w-16 px-2 py-1.5 border border-slate-300 rounded-md text-center text-sm focus:ring-2 ${opMeta.ring}`}
                          value={th.maxLimit === -1 ? "" : th.maxLimit}
                          onChange={(e) => {
                            const v = e.target.value;
                            setThreshold(op, { maxLimit: v === "" ? -1 : parseInt(v, 10) || 0 });
                          }}
                          placeholder="-1"
                        />
                        <span>operations within</span>
                        <input
                          type="number"
                          className={`w-16 px-2 py-1.5 border border-slate-300 rounded-md text-center text-sm focus:ring-2 ${opMeta.ring}`}
                          value={th.minutes || ""}
                          onChange={(e) =>
                            setThreshold(op, { minutes: parseInt(e.target.value, 10) || 0 })
                          }
                          placeholder="0"
                        />
                        <span>minutes then</span>
                        <select
                          className={`px-2 py-1.5 border border-slate-300 rounded-md bg-white text-sm focus:ring-2 ${opMeta.ring}`}
                          value={th.action}
                          onChange={(e) => setThreshold(op, { action: e.target.value })}
                        >
                          <option value="continue">Continue</option>
                          <option value="stop">Stop</option>
                          <option value="pause">Pause</option>
                        </select>
                        <span>further operations and send alert to email</span>
                        <input
                          type="email"
                          className={`w-44 px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 ${opMeta.ring}`}
                          placeholder="email@example.com"
                          value={th.email}
                          onChange={(e) => setThreshold(op, { email: e.target.value })}
                        />
                      </div>

                      {showExceptional && (
                        <div className="mt-4 rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-slate-50/40 overflow-hidden">
                          <div
                            className="flex items-center gap-2 cursor-pointer px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100/80 transition-colors"
                            onClick={() =>
                              setExceptional(op, { isExceptionalExpanded: !exc.isExceptionalExpanded })
                            }
                            role="button"
                            aria-expanded={exc.isExceptionalExpanded}
                          >
                            {exc.isExceptionalExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            Exceptional Cases
                          </div>
                          {exc.isExceptionalExpanded && (
                            <div className="px-3 pb-3 pt-1 space-y-2">
                              {/* Peak Days */}
                              <div className="rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white shadow-sm overflow-hidden">
                                <div
                                  className="flex items-center justify-between cursor-pointer px-4 py-3 hover:bg-slate-50 transition-colors"
                                  onClick={() =>
                                    setExceptional(op, {
                                      isPeakDaysExpanded: !exc.isPeakDaysExpanded,
                                      ...(!exc.isPeakDaysExpanded ? { isPeakTimeExpanded: false } : {}),
                                    })
                                  }
                                  role="button"
                                  aria-expanded={exc.isPeakDaysExpanded}
                                >
                                  <span className="text-sm font-medium text-slate-700">Peak Days</span>
                                  {exc.isPeakDaysExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                  )}
                                </div>
                                {exc.isPeakDaysExpanded && (
                                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100">
                                    {exc.peakDays.map((range, idx) => (
                                      <div
                                        key={range.id}
                                        className="flex flex-nowrap items-center gap-2"
                                      >
                                        <span className="text-slate-600 text-sm shrink-0">Start Date</span>
                                        <div className="relative w-52 shrink-0">
                                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                                          <input
                                            type="date"
                                            className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                            value={range.startDate}
                                            onChange={(e) =>
                                              updatePeakDayRange(op, range.id, "startDate", e.target.value)
                                            }
                                          />
                                        </div>
                                        <span className="text-slate-600 text-sm shrink-0">End Date</span>
                                        <div className="relative w-52 shrink-0">
                                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                                          <input
                                            type="date"
                                            className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                            value={range.endDate}
                                            onChange={(e) =>
                                              updatePeakDayRange(op, range.id, "endDate", e.target.value)
                                            }
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removePeakDayRange(op, range.id)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                                          aria-label="Remove date range"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                        {idx === exc.peakDays.length - 1 && (
                                          <button
                                            type="button"
                                            onClick={() => addPeakDayRange(op)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                                            aria-label="Add date range"
                                          >
                                            <Plus className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {/* Peak Time */}
                              <div className="rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white shadow-sm overflow-hidden">
                                <div
                                  className="flex items-center justify-between cursor-pointer px-4 py-3 hover:bg-slate-50 transition-colors"
                                  onClick={() =>
                                    setExceptional(op, {
                                      isPeakTimeExpanded: !exc.isPeakTimeExpanded,
                                      ...(!exc.isPeakTimeExpanded ? { isPeakDaysExpanded: false } : {}),
                                    })
                                  }
                                  role="button"
                                  aria-expanded={exc.isPeakTimeExpanded}
                                >
                                  <span className="text-sm font-medium text-slate-700">Peak Time</span>
                                  {exc.isPeakTimeExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                  )}
                                </div>
                                {exc.isPeakTimeExpanded && (
                                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100">
                                    {exc.peakTimes.map((range, idx) => (
                                      <div
                                        key={range.id}
                                        className="flex flex-nowrap items-center gap-2"
                                      >
                                        <span className="text-slate-600 text-sm shrink-0">Start Date</span>
                                        <div className="relative w-52 shrink-0">
                                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                                          <input
                                            type="date"
                                            className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                            value={range.startDate}
                                            onChange={(e) =>
                                              updatePeakTimeRange(op, range.id, "startDate", e.target.value)
                                            }
                                          />
                                        </div>
                                        <span className="text-slate-600 text-sm shrink-0">End Date</span>
                                        <div className="relative w-52 shrink-0">
                                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                                          <input
                                            type="date"
                                            className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                            value={range.endDate}
                                            onChange={(e) =>
                                              updatePeakTimeRange(op, range.id, "endDate", e.target.value)
                                            }
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removePeakTimeRange(op, range.id)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                                          aria-label="Remove date range"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                        {idx === exc.peakTimes.length - 1 && (
                                          <button
                                            type="button"
                                            onClick={() => addPeakTimeRange(op)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                                            aria-label="Add date range"
                                          >
                                            <Plus className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

            </>
          )}

          {/* Submit and Cancel - hidden in wizard mode (e.g. add-application step 5) */}
          {!wizardMode && (
          <div className="mt-6 flex flex-col gap-3 pt-4 border-t border-slate-200">
            {submitError && (
              <p className="text-sm text-red-600" role="alert">
                {submitError}
              </p>
            )}
            {submitSuccess && (
              <p className="text-sm text-green-600" role="status">
                Settings saved successfully.
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
          )}

      {/* Process Event modal (Add Service) */}
      {isProcessEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">Process Event</h2>
              <button
                type="button"
                onClick={closeProcessEventModal}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (isProcessEventFormValid) {
                  addServiceRow();
                }
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint</label>
                <input
                  type="text"
                  value={processEventForm.endpoint}
                  onChange={(e) => setProcessEventForm((p) => ({ ...p, endpoint: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder=""
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authorization</label>
                <input
                  type="text"
                  value={processEventForm.authorization}
                  onChange={(e) => setProcessEventForm((p) => ({ ...p, authorization: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder=""
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
                <input
                  type="text"
                  value={processEventForm.operation}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="process-event-enabled"
                  checked={processEventForm.isEnabled}
                  onChange={(e) => setProcessEventForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="process-event-enabled" className="text-sm font-medium text-gray-700">
                  Is Enabled
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Custom Headers</label>
                <div className="space-y-2">
                  {customHeaders.length === 0 ? (
                    <div className="flex items-center gap-2 min-h-[42px]">
                      <div className="flex-1 min-w-0" />
                      <div className="flex-1 min-w-0" />
                      <div className="w-10 h-10 flex-shrink-0" />
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={addCustomHeader}
                          className="p-2 h-10 w-10 flex items-center justify-center text-green-600 hover:bg-green-50 rounded-full bg-green-100"
                          aria-label="Add header"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                  customHeaders.map((header, index) => (
                    <div key={index} className="flex items-center gap-2 min-h-[42px]">
                      <input
                        type="text"
                        value={header.name}
                        onChange={(e) => updateCustomHeader(index, "name", e.target.value)}
                        className="flex-1 min-w-0 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => updateCustomHeader(index, "value", e.target.value)}
                        className="flex-1 min-w-0 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Value"
                      />
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeCustomHeader(index)}
                          className="p-2 h-10 w-10 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
                          aria-label="Remove header"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                        {index === customHeaders.length - 1 ? (
                          <button
                            type="button"
                            onClick={addCustomHeader}
                            className="p-2 h-10 w-10 flex items-center justify-center text-green-600 hover:bg-green-50 rounded-full bg-green-100"
                            aria-label="Add header"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeProcessEventModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isProcessEventFormValid}
                  className={`px-4 py-2 text-sm font-medium rounded ${
                    isProcessEventFormValid
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SDK modal (Add SDK) */}
      {SHOW_SDK_SECTION && isSdkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">SDK Configuration</h2>
              <button
                type="button"
                onClick={closeSdkModal}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (isSdkFormValid) addSdkRow();
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Implementation Class</label>
                <input
                  type="text"
                  value={sdkForm.implementationClass}
                  onChange={(e) => setSdkForm((p) => ({ ...p, implementationClass: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Id</label>
                <input
                  type="text"
                  value={sdkForm.agentId}
                  onChange={(e) => setSdkForm((p) => ({ ...p, agentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
                <input
                  type="text"
                  value={sdkForm.operation}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sdk-enabled"
                  checked={sdkForm.isEnabled}
                  onChange={(e) => setSdkForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="sdk-enabled" className="text-sm font-medium text-gray-700">Is Enabled</label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeSdkModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isSdkFormValid}
                  className={`px-4 py-2 text-sm font-medium rounded ${
                    isSdkFormValid
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
  );
});

export default AdvanceSettingTab;
