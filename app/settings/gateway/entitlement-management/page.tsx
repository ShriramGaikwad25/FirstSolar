"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Edit,
  Check,
  X,
  ChevronDown,
  Info,
  Briefcase,
  Cpu,
  RefreshCw,
  Layers,
} from "lucide-react";
import { resolveTenantIdForHeader, getJwtAuthHeaders } from "@/lib/auth";

type FieldCategory = "general" | "business" | "technical" | "security" | "lifecycle" | "other";

/** Fallback grouping (same as the Entitlement Details sidebar) when the API gives no category */
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

const CATEGORY_ORDER: FieldCategory[] = ["general", "business", "technical", "security", "lifecycle", "other"];

const CATEGORY_META: Record<
  FieldCategory,
  { label: string; icon: typeof Info; badgeBg: string; badgeText: string; borderColor: string; chipBg: string; chipText: string }
> = {
  general: { label: "General", icon: Info, badgeBg: "bg-blue-100", badgeText: "text-blue-700", borderColor: "border-l-blue-400", chipBg: "bg-blue-50", chipText: "text-blue-700" },
  business: { label: "Business", icon: Briefcase, badgeBg: "bg-amber-100", badgeText: "text-amber-700", borderColor: "border-l-amber-400", chipBg: "bg-amber-50", chipText: "text-amber-700" },
  technical: { label: "Technical", icon: Cpu, badgeBg: "bg-purple-100", badgeText: "text-purple-700", borderColor: "border-l-purple-400", chipBg: "bg-purple-50", chipText: "text-purple-700" },
  security: { label: "Security", icon: ShieldCheck, badgeBg: "bg-red-100", badgeText: "text-red-700", borderColor: "border-l-red-400", chipBg: "bg-red-50", chipText: "text-red-700" },
  lifecycle: { label: "Lifecycle", icon: RefreshCw, badgeBg: "bg-teal-100", badgeText: "text-teal-700", borderColor: "border-l-teal-400", chipBg: "bg-teal-50", chipText: "text-teal-700" },
  other: { label: "Other", icon: Layers, badgeBg: "bg-gray-100", badgeText: "text-gray-700", borderColor: "border-l-gray-400", chipBg: "bg-gray-100", chipText: "text-gray-700" },
};

const DATA_TYPES = ["Text", "Boolean", "Date", "List", "JSON"] as const;
type DataType = (typeof DATA_TYPES)[number];
type ListType = "static" | "dynamic";

interface FieldConfig {
  name: string;
  label: string;
  tooltip: string;
  dataType: DataType;
  /** Only used when dataType is "List" */
  listType: ListType;
  /** Static list values, comma separated */
  listValues: string;
  /** Dynamic list source */
  apiEndpoint: string;
  displayOnly: boolean;
  showInUI: boolean;
}

function splitListValues(raw: string): string[] {
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

const CATALOG_METADATA_URL = () =>
  `https://preview.keyforge.ai/catalog/api/v1/${resolveTenantIdForHeader()}/catalog-metadata/list`;

function pickStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(t)) return true;
    if (["false", "no", "n", "0"].includes(t)) return false;
  }
  return fallback;
}

/** "Last Reviewed On" / "last_reviewed_on" / "lastReviewedOn" -> "lastreviewedon" */
const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const CATEGORY_BY_NORMALIZED_KEY: Record<string, FieldCategory> = Object.fromEntries(
  Object.entries(FIELD_CATEGORY_MAP).map(([k, v]) => [normalizeKey(k), v])
);

function toDataType(v: unknown): DataType {
  const t = normalizeKey(String(v ?? ""));
  if (["boolean", "bool"].includes(t)) return "Boolean";
  if (["date", "datetime", "timestamp"].includes(t)) return "Date";
  if (["list", "enum", "picklist", "select", "dropdown"].includes(t)) return "List";
  if (["json", "object"].includes(t)) return "JSON";
  return "Text";
}

function toListValues(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        x && typeof x === "object" ? pickStr((x as any).value, (x as any).label, (x as any).name) : pickStr(x)
      )
      .filter(Boolean)
      .join(", ");
  }
  return pickStr(v) ?? "";
}

function toCategory(item: any, name: string, label: string): FieldCategory {
  const raw = normalizeKey(pickStr(item?.category, item?.group, item?.section, item?.categoryName) ?? "");
  if ((CATEGORY_ORDER as string[]).includes(raw)) return raw as FieldCategory;
  return CATEGORY_BY_NORMALIZED_KEY[normalizeKey(label)] ?? CATEGORY_BY_NORMALIZED_KEY[normalizeKey(name)] ?? "other";
}

/** Unwrap the list from the catalog-metadata response ({content|items|data|...} or a bare array) */
function extractMetadataItems(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of ["content", "items", "data", "metadata", "fields", "result", "results"]) {
    const v = json?.[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && Array.isArray(v.content)) return v.content;
  }
  return [];
}

interface MetadataField {
  key: string;
  category: FieldCategory;
  config: FieldConfig;
  /** Original API item, kept for the save call */
  raw: any;
}

function mapMetadataItem(item: any, index: number): MetadataField {
  const name =
    pickStr(item?.columnName, item?.name, item?.fieldName, item?.field_name, item?.key, item?.attributeName) ?? `field${index + 1}`;
  const label = pickStr(item?.label, item?.displayName, item?.display_name, item?.displayLabel) ?? name;
  const listTypeRaw = normalizeKey(pickStr(item?.listType, item?.list_type, item?.listSource, item?.list_source) ?? "");
  return {
    key: pickStr(item?.id, item?.metadataId) ?? `${name}-${index}`,
    category: toCategory(item, name, label),
    raw: item,
    config: {
      name,
      label,
      tooltip: pickStr(item?.tooltip, item?.toolTip, item?.tool_tip, item?.helpText) ?? "",
      dataType: toDataType(pickStr(item?.dataType, item?.data_type, item?.datatype, item?.type)),
      listType: listTypeRaw.includes("dynamic") ? "dynamic" : "static",
      listValues: toListValues(item?.listValues ?? item?.list_values ?? item?.values ?? item?.options),
      apiEndpoint: pickStr(item?.apiEndpoint, item?.api_endpoint, item?.endpoint, item?.listApiEndpoint) ?? "",
      displayOnly: toBool(item?.displayOnly ?? item?.display_only ?? item?.readOnly ?? item?.readonly, false),
      showInUI: toBool(item?.showInUI ?? item?.showInUi ?? item?.show_in_ui ?? item?.visible, true),
    },
  };
}

const ROW_GRID =
  "grid grid-cols-[minmax(150px,1fr)_minmax(170px,1.2fr)_minmax(200px,1.6fr)_140px_104px_104px] gap-3";

const inputClass =
  "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
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
      } ${checked ? "bg-blue-600" : "bg-gray-300"}`}
    >
      <span
        className={`inline-block h-[15px] w-[15px] transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[15px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

/** Tag-style editor for static list values; stored as a comma separated string */
function ListValuesEditor({
  value,
  editable,
  compact = false,
  onChange,
}: {
  value: string;
  editable: boolean;
  compact?: boolean;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const values = splitListValues(value);

  const commit = (text: string) => {
    const added = splitListValues(text).filter((v) => !values.includes(v));
    if (added.length) onChange([...values, ...added].join(", "));
    setDraft("");
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v).join(", "));

  if (!editable) {
    return values.length ? (
      <div className="flex flex-wrap gap-1.5 py-0.5">
        {values.map((v) => (
          <span key={v} className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-700">
            {v}
          </span>
        ))}
      </div>
    ) : (
      <div className="py-1 text-sm text-gray-400">No values</div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 border rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${
        compact ? "min-h-[32px] px-2 py-1 border-blue-200 shadow-sm" : "min-h-[34px] px-2 py-1 border-gray-300"
      }`}
    >
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700">
          {v}
          <button
            type="button"
            onClick={() => remove(v)}
            aria-label={`Remove ${v}`}
            className="rounded-full p-0.5 hover:bg-blue-100"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          const text = e.target.value;
          if (text.includes(",")) commit(text);
          else setDraft(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && values.length) {
            remove(values[values.length - 1]);
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={values.length ? "Add value" : "Type a value and press Enter"}
        className={`flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-gray-400 ${compact ? "text-xs" : "text-sm py-0.5"}`}
      />
    </div>
  );
}

export default function EntitlementManagementSettings() {
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [configs, setConfigs] = useState<Record<string, FieldConfig>>({});
  const [savedConfigs, setSavedConfigs] = useState<Record<string, FieldConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(CATALOG_METADATA_URL(), { headers: getJwtAuthHeaders() });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(pickStr(json?.errorMessage, json?.message) || `Request failed (${res.status})`);
        }
        const mapped = extractMetadataItems(json).map(mapMetadataItem);
        if (cancelled) return;
        const byKey = Object.fromEntries(mapped.map((f) => [f.key, f.config]));
        setFields(mapped);
        setConfigs(byKey);
        setSavedConfigs(byKey);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load catalog metadata");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fieldsByCategory = useMemo(() => {
    const out = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, [] as string[]])) as Record<FieldCategory, string[]>;
    for (const f of fields) out[f.category].push(f.key);
    return out;
  }, [fields]);

  const updateField = useCallback((field: string, patch: Partial<FieldConfig>) => {
    setConfigs((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
  }, []);

  const handleSave = () => {
    // TODO: Persist field configuration once the save endpoint is available.
    setSavedConfigs(configs);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setConfigs(savedConfigs);
    setIsEditing(false);
  };

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Compact inline "List options" line shown under a List field's row while editing
  const renderListPanel = (field: string, cfg: FieldConfig) => (
    <div className="px-5 pb-3">
      <div className="flex items-center gap-4 rounded-md border border-blue-100 border-l-[3px] border-l-blue-400 bg-blue-50/60 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 shrink-0">List options</span>
        <div className="inline-flex shrink-0 rounded-md border border-blue-200 bg-white p-0.5 shadow-sm">
          {(["static", "dynamic"] as ListType[]).map((lt) => {
            const active = cfg.listType === lt;
            return (
              <button
                key={lt}
                type="button"
                onClick={() => updateField(field, { listType: lt })}
                aria-pressed={active}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  active ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {lt === "static" ? "Static" : "Dynamic Entity"}
              </button>
            );
          })}
        </div>
        <span className="h-5 w-px bg-blue-200 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0 max-w-xl">
          {cfg.listType === "static" ? (
            <ListValuesEditor
              value={cfg.listValues}
              editable
              compact
              onChange={(next) => updateField(field, { listValues: next })}
            />
          ) : (
            <input
              type="text"
              value={cfg.apiEndpoint}
              onChange={(e) => updateField(field, { apiEndpoint: e.target.value })}
              placeholder="API endpoint, e.g. https://preview.keyforge.ai/..."
              aria-label={`API endpoint — ${field}`}
              className="w-full h-8 px-2.5 border border-blue-200 rounded-md text-xs font-mono bg-white shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );

  const listSummary = (cfg: FieldConfig) => {
    if (cfg.listType === "dynamic") {
      return cfg.apiEndpoint.trim()
        ? { text: "Dynamic · API", title: cfg.apiEndpoint, missing: false }
        : { text: "Dynamic · no endpoint", title: "", missing: true };
    }
    const values = splitListValues(cfg.listValues);
    return values.length
      ? { text: `Static · ${values.length} value${values.length === 1 ? "" : "s"}`, title: values.join(", "), missing: false }
      : { text: "Static · no values", title: "", missing: true };
  };

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
              <p className="text-xs text-gray-500">Configure how each entitlement field is labeled, typed and shown</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-2 rounded-full px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </>
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
        {loadError && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-sm">
            {loadError}
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Loading entitlement metadata...</p>
            </div>
          </div>
        ) : fields.length === 0 ? (
          !loadError && (
            <div className="flex items-center justify-center py-24 text-sm text-gray-400">
              No entitlement metadata found.
            </div>
          )
        ) : (
        <div className="space-y-3">
          {CATEGORY_ORDER.map((catKey) => {
            const meta = CATEGORY_META[catKey];
            const CategoryIcon = meta.icon;
            const fields = fieldsByCategory[catKey];
            if (fields.length === 0) return null;
            const shownCount = fields.filter((f) => configs[f]?.showInUI).length;
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
                      {shownCount}/{fields.length} shown in UI
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                  </div>
                </button>

                {!collapsed && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <div className="min-w-[960px]">
                      <div className={`${ROW_GRID} px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400`}>
                        <span>Name</span>
                        <span>Label</span>
                        <span>Tool Tip</span>
                        <span>Data Type</span>
                        <span className="text-center">Display Only</span>
                        <span className="text-center">Show In UI</span>
                      </div>
                      {fields.map((field) => {
                        const cfg = configs[field];
                        return (
                          <div key={field} className="border-t border-gray-100">
                            <div className={`${ROW_GRID} items-center px-5 py-2.5`}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={cfg.name}
                                  onChange={(e) => updateField(field, { name: e.target.value })}
                                  aria-label={`Name — ${field}`}
                                  className={`${inputClass} font-mono`}
                                />
                              ) : (
                                <span className="text-sm text-gray-800 font-mono truncate" title={cfg.name}>
                                  {cfg.name}
                                </span>
                              )}
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={cfg.label}
                                  onChange={(e) => updateField(field, { label: e.target.value })}
                                  aria-label={`Label — ${field}`}
                                  className={inputClass}
                                />
                              ) : (
                                <span className="text-sm text-gray-800 truncate" title={cfg.label}>
                                  {cfg.label}
                                </span>
                              )}
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={cfg.tooltip}
                                  onChange={(e) => updateField(field, { tooltip: e.target.value })}
                                  placeholder="Help text shown on hover"
                                  aria-label={`Tool tip — ${field}`}
                                  className={inputClass}
                                />
                              ) : (
                                <span className={`text-sm truncate ${cfg.tooltip ? "text-gray-700" : "text-gray-400"}`} title={cfg.tooltip}>
                                  {cfg.tooltip || "—"}
                                </span>
                              )}
                              {isEditing ? (
                                <select
                                  value={cfg.dataType}
                                  onChange={(e) => updateField(field, { dataType: e.target.value as DataType })}
                                  aria-label={`Data type — ${field}`}
                                  className={inputClass}
                                >
                                  {DATA_TYPES.map((dt) => (
                                    <option key={dt} value={dt}>
                                      {dt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="min-w-0">
                                  <span className="text-sm text-gray-800">{cfg.dataType}</span>
                                  {cfg.dataType === "List" && (() => {
                                    const sum = listSummary(cfg);
                                    return (
                                      <div
                                        className={`text-xs truncate ${sum.missing ? "text-amber-600" : "text-gray-500"}`}
                                        title={sum.title}
                                      >
                                        {sum.text}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              <div className="flex justify-center">
                                <ToggleSwitch
                                  checked={cfg.displayOnly}
                                  disabled={!isEditing}
                                  ariaLabel={`Display only — ${field}`}
                                  onChange={(next) => updateField(field, { displayOnly: next })}
                                />
                              </div>
                              <div className="flex justify-center">
                                <ToggleSwitch
                                  checked={cfg.showInUI}
                                  disabled={!isEditing}
                                  ariaLabel={`Show in UI — ${field}`}
                                  onChange={(next) => updateField(field, { showInUI: next })}
                                />
                              </div>
                            </div>
                            {isEditing && cfg.dataType === "List" && renderListPanel(field, cfg)}
                          </div>
                        );
                      })}
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
