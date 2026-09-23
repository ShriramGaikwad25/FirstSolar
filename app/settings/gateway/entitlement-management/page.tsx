"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Edit,
  Check,
  ChevronDown,
  Info,
  Briefcase,
  Cpu,
  RefreshCw,
} from "lucide-react";

const ENTITLEMENT_FIELDS = [
  'ID',
  'Type',
  'Application Name',
  'Entitlement Name',
  'Description',
  'Total Assignments',
  'Dynamic Tag',
  'Business Objective',
  'Business Unit',
  'Entitlement Owner',
  'Compliance Type',
  'Data Classification',
  'Cost Center',
  'Created On',
  'Last Sync',
  'Application Instance',
  'Application Owner',
  'Hierarchy',
  'MFA Status',
  'Assignment',
  'License Type',
  'Risk',
  'Certifiable',
  'Revoke on Disable',
  'Shared Pwd',
  'SOD Check',
  'Access Scope',
  'Review Schedule',
  'Last Reviewed On',
  'Privileged',
  'Non Persistent Access',
  'Audit Comments',
  'Account Type Restriction',
  'Requestable',
  'Pre-Requisite',
  'Pre-Requisite Details',
  'Auto Assign Access Policy',
  'Provisioner Group',
  'Provisioning Steps',
  'Provisioning Mechanism',
  'Action on Native Change'
];

/** Entitlement metadata fields that do not show GenAI / Edit on Review checkboxes (Selection always has checkboxes) */
const FIELDS_WITHOUT_CHECKBOXES = new Set<string>([
  'ID',
  'Type',
  'Application Name',
  'Total Assignments',
  'Created On',
  'Last Sync',
  'Application Instance',
  'Last Reviewed On',
]);

function isCheckboxHiddenForField(fieldName: string): boolean {
  return FIELDS_WITHOUT_CHECKBOXES.has(fieldName);
}

type FieldCategory = "general" | "business" | "technical" | "security" | "lifecycle";

/** Same grouping used by the Entitlement Details sidebar elsewhere in the app */
const FIELD_CATEGORY_MAP: Record<string, FieldCategory> = {
  'ID': "general",
  'Type': "general",
  'Application Name': "general",
  'Entitlement Name': "general",
  'Description': "general",
  'Total Assignments': "general",
  'Dynamic Tag': "general",
  'Business Objective': "business",
  'Business Unit': "business",
  'Entitlement Owner': "business",
  'Compliance Type': "business",
  'Data Classification': "business",
  'Cost Center': "business",
  'Created On': "technical",
  'Last Sync': "technical",
  'Application Instance': "technical",
  'Application Owner': "technical",
  'Hierarchy': "technical",
  'MFA Status': "technical",
  'Assignment': "technical",
  'License Type': "technical",
  'Risk': "security",
  'Certifiable': "security",
  'Revoke on Disable': "security",
  'Shared Pwd': "security",
  'SOD Check': "security",
  'Access Scope': "security",
  'Review Schedule': "security",
  'Last Reviewed On': "security",
  'Privileged': "security",
  'Non Persistent Access': "security",
  'Audit Comments': "security",
  'Account Type Restriction': "security",
  'Requestable': "lifecycle",
  'Pre-Requisite': "lifecycle",
  'Pre-Requisite Details': "lifecycle",
  'Auto Assign Access Policy': "lifecycle",
  'Provisioner Group': "lifecycle",
  'Provisioning Steps': "lifecycle",
  'Provisioning Mechanism': "lifecycle",
  'Action on Native Change': "lifecycle",
};

const CATEGORY_ORDER: FieldCategory[] = ["general", "business", "technical", "security", "lifecycle"];

const CATEGORY_META: Record<
  FieldCategory,
  { label: string; icon: typeof Info; badgeBg: string; badgeText: string; borderColor: string; chipBg: string; chipText: string }
> = {
  general: { label: "General", icon: Info, badgeBg: "bg-blue-100", badgeText: "text-blue-700", borderColor: "border-l-blue-400", chipBg: "bg-blue-50", chipText: "text-blue-700" },
  business: { label: "Business", icon: Briefcase, badgeBg: "bg-amber-100", badgeText: "text-amber-700", borderColor: "border-l-amber-400", chipBg: "bg-amber-50", chipText: "text-amber-700" },
  technical: { label: "Technical", icon: Cpu, badgeBg: "bg-purple-100", badgeText: "text-purple-700", borderColor: "border-l-purple-400", chipBg: "bg-purple-50", chipText: "text-purple-700" },
  security: { label: "Security", icon: ShieldCheck, badgeBg: "bg-red-100", badgeText: "text-red-700", borderColor: "border-l-red-400", chipBg: "bg-red-50", chipText: "text-red-700" },
  lifecycle: { label: "Lifecycle", icon: RefreshCw, badgeBg: "bg-teal-100", badgeText: "text-teal-700", borderColor: "border-l-teal-400", chipBg: "bg-teal-50", chipText: "text-teal-700" },
};

const FIELDS_BY_CATEGORY: Record<FieldCategory, string[]> = CATEGORY_ORDER.reduce((acc, cat) => {
  acc[cat] = ENTITLEMENT_FIELDS.filter((field) => FIELD_CATEGORY_MAP[field] === cat);
  return acc;
}, {} as Record<FieldCategory, string[]>);

interface EntitlementData {
  id: string;
  // Main fields
  entName?: string;
  entDescription?: string;
  entId?: string;
  // General
  entType?: string;
  totalAssignments?: string;
  appName?: string;
  dynamicTag?: string;
  // Business
  businessObjective?: string;
  businessUnit?: string;
  entOwner?: string;
  complianceType?: string;
  dataClassification?: string;
  costCenter?: string;
  // Technical
  createdOn?: string;
  lastSync?: string;
  appInstance?: string;
  appOwner?: string;
  hierarchy?: string;
  mfaStatus?: string;
  assignment?: string;
  licenseType?: string;
  // Security
  risk?: string;
  certifiable?: string;
  revokeOnDisable?: string;
  sharedPwd?: string;
  sodCheck?: string;
  accessScope?: string;
  reviewSchedule?: string;
  lastReviewedOn?: string;
  privileged?: string;
  nonPersistentAccess?: string;
  auditComments?: string;
  accountTypeRestriction?: string;
  // Lifecycle
  requestable?: string;
  preRequisite?: string;
  preRequisiteDetails?: string;
  autoAssignAccessPolicy?: string;
  provisionerGroup?: string;
  provisioningSteps?: string;
  provisioningMechanism?: string;
  actionOnNativeChange?: string;
  // Table controls - per field selection
  fieldSelection?: Record<string, boolean>;
  fieldGenAI?: Record<string, boolean>;
  fieldEditOnReview?: Record<string, boolean>;
}

type ToggleKind = "sel" | "genai" | "edit";

const TOGGLE_ON_CLASS: Record<ToggleKind, string> = {
  sel: "bg-blue-600",
  genai: "bg-purple-600",
  edit: "bg-emerald-600",
};

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  kind,
  ariaLabel,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  kind: ToggleKind;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[19px] w-[34px] shrink-0 items-center rounded-full transition-colors ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? TOGGLE_ON_CLASS[kind] : "bg-gray-300"}`}
    >
      <span
        className={`inline-block h-[15px] w-[15px] transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[15px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export default function EntitlementManagementSettings() {
  const [entitlements, setEntitlements] = useState<EntitlementData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (dataLoaded) return; // Prevent duplicate loading

    const controller = new AbortController();
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // TODO: Replace with actual API endpoint when available
        // const res = await fetch("API_ENDPOINT_HERE", { signal: controller.signal });
        // if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        // const data = await res.json();
        // if (isMounted) setRows(data);

        // Placeholder data for now - includes all fields from Entitlement Details sidebar
        const placeholderData: EntitlementData[] = [
          {
            id: '1',
            entName: 'Administrator Access',
            entDescription: 'Full administrative access to the system',
            entId: 'ENT-001',
            entType: 'Role',
            totalAssignments: '25',
            appName: 'Active Directory',
            dynamicTag: 'IT, Admin',
            businessObjective: 'System Administration',
            businessUnit: 'IT Operations',
            entOwner: 'John Doe',
            complianceType: 'SOX',
            dataClassification: 'Confidential',
            costCenter: 'CC-IT-001',
            createdOn: '2024-01-15',
            lastSync: '2024-12-10',
            appInstance: 'AD-PROD-01',
            appOwner: 'Jane Smith',
            hierarchy: 'Domain Admin > Admin',
            mfaStatus: 'Enabled',
            assignment: 'Direct',
            licenseType: 'Enterprise',
            risk: 'High',
            certifiable: 'Yes',
            revokeOnDisable: 'Yes',
            sharedPwd: 'No',
            sodCheck: 'None',
            accessScope: 'Global',
            reviewSchedule: 'Quarterly',
            lastReviewedOn: '2024-09-15',
            privileged: 'Yes',
            nonPersistentAccess: 'No',
            auditComments: 'Regular review required',
            accountTypeRestriction: 'Service Account',
            requestable: 'Yes',
            preRequisite: 'Security Training',
            preRequisiteDetails: 'Complete security awareness training',
            autoAssignAccessPolicy: 'Policy-001',
            provisionerGroup: 'IT-Provisioning',
            provisioningSteps: 'Step 1: Create account, Step 2: Assign role',
            provisioningMechanism: 'Automated',
            actionOnNativeChange: 'Sync',
            fieldSelection: {},
            fieldGenAI: {},
            fieldEditOnReview: {}
          }
        ];
        if (isMounted) {
          setEntitlements(placeholderData);
          setDataLoaded(true);
        }
      } catch (e: any) {
        if (e.name !== "AbortError" && isMounted) {
          setError(e?.message || "Failed to load data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dataLoaded]);

  const handleSelectionChange = useCallback((entitlementId: string, fieldName: string, checked: boolean) => {
    setEntitlements(prev => {
      return prev.map(ent => {
        if (ent.id === entitlementId) {
          const fieldSelection = ent.fieldSelection || {};
          return { ...ent, fieldSelection: { ...fieldSelection, [fieldName]: checked } };
        }
        return ent;
      });
    });
  }, []);

  const handleGenAIChange = useCallback((entitlementId: string, fieldName: string, checked: boolean) => {
    setEntitlements(prev => {
      return prev.map(ent => {
        if (ent.id === entitlementId) {
          const fieldGenAI = ent.fieldGenAI || {};
          return { ...ent, fieldGenAI: { ...fieldGenAI, [fieldName]: checked } };
        }
        return ent;
      });
    });
  }, []);

  const handleEditOnReviewChange = useCallback((entitlementId: string, fieldName: string, checked: boolean) => {
    setEntitlements(prev => {
      return prev.map(ent => {
        if (ent.id === entitlementId) {
          const fieldEditOnReview = ent.fieldEditOnReview || {};
          return { ...ent, fieldEditOnReview: { ...fieldEditOnReview, [fieldName]: checked } };
        }
        return ent;
      });
    });
  }, []);

  const handleSave = () => {
    // TODO: Persist changes once save endpoint is available.
    setIsEditing(false);
  };

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const entitlement = entitlements[0];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Entitlement Management</h1>
              <p className="text-xs text-gray-500">Control which entitlement fields are selectable, GenAI-enabled, or editable on review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-50 p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Loading entitlements...</p>
            </div>
          </div>
        ) : !entitlement ? (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400">
            No entitlement metadata found.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" /> Selection
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600" /> GenAI
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> Edit on Review
              </span>
            </div>

            <div className="space-y-3">
              {CATEGORY_ORDER.map((catKey) => {
                const meta = CATEGORY_META[catKey];
                const CategoryIcon = meta.icon;
                const fields = FIELDS_BY_CATEGORY[catKey];
                if (fields.length === 0) return null;
                const selectedCount = fields.filter((f) => entitlement.fieldSelection?.[f] ?? true).length;
                const collapsed = !!collapsedCategories[catKey];

                return (
                  <div
                    key={catKey}
                    className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${meta.borderColor} overflow-hidden`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(catKey)}
                      aria-expanded={!collapsed}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 ${meta.badgeBg} ${meta.badgeText}`}>
                          <CategoryIcon className="w-4 h-4" />
                        </span>
                        <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
                        <span className="text-xs text-gray-400">{fields.length} fields</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${meta.chipBg} ${meta.chipText}`}>
                          {selectedCount}/{fields.length} selected
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                      </div>
                    </button>

                    {!collapsed && (
                      <div className="border-t border-gray-100">
                        <div className="grid grid-cols-[1fr_96px_96px_120px] gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          <span>Field</span>
                          <span className="text-center">Selection</span>
                          <span className="text-center">GenAI</span>
                          <span className="text-center">Edit on Review</span>
                        </div>
                        {fields.map((field) => {
                          const hidden = isCheckboxHiddenForField(field);
                          const selected = entitlement.fieldSelection?.[field] ?? true;
                          const genAI = entitlement.fieldGenAI?.[field] ?? !hidden;
                          const editOnReview = entitlement.fieldEditOnReview?.[field] || false;
                          return (
                            <div
                              key={field}
                              className="grid grid-cols-[1fr_96px_96px_120px] gap-2 items-center px-5 py-2.5 border-t border-gray-100 first:border-t-0"
                            >
                              <span className="text-sm text-gray-800 truncate">{field}</span>
                              <div className="flex justify-center">
                                <ToggleSwitch
                                  kind="sel"
                                  checked={selected}
                                  disabled={!isEditing}
                                  ariaLabel={`Selection — ${field}`}
                                  onChange={(next) => handleSelectionChange(entitlement.id, field, next)}
                                />
                              </div>
                              <div className="flex justify-center">
                                {hidden ? (
                                  <span className="text-gray-300 text-sm" aria-hidden="true">—</span>
                                ) : (
                                  <ToggleSwitch
                                    kind="genai"
                                    checked={genAI}
                                    disabled={!isEditing}
                                    ariaLabel={`GenAI — ${field}`}
                                    onChange={(next) => handleGenAIChange(entitlement.id, field, next)}
                                  />
                                )}
                              </div>
                              <div className="flex justify-center">
                                {hidden ? (
                                  <span className="text-gray-300 text-sm" aria-hidden="true">—</span>
                                ) : (
                                  <ToggleSwitch
                                    kind="edit"
                                    checked={editOnReview}
                                    disabled={!isEditing}
                                    ariaLabel={`Edit on Review — ${field}`}
                                    onChange={(next) => handleEditOnReviewChange(entitlement.id, field, next)}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
