"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Controller, useForm, type Control, type FieldValues, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import Select, { type MultiValue, type StylesConfig } from "react-select";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { executeQuery } from "@/lib/api";
import {
  extractRotationPolicyDetailRow,
  ROTATION_POLICY_BY_ID_QUERY,
} from "@/lib/nhi-rotation-policy-detail";

const CREDENTIAL_TYPE_OPTIONS = [
  { label: "Passwords", value: "passwords" },
  { label: "Keys", value: "keys" },
  { label: "Tokens", value: "tokens" },
  { label: "Certs", value: "certs" },
];

const NHI_TYPE_OPTIONS = [
  { label: "API Key", value: "api_key" },
  { label: "Service Account", value: "service_account" },
  { label: "Certificate", value: "certificate" },
  { label: "Workload/Container", value: "workload" },
  { label: "AI Agent", value: "ai_agent" },
  { label: "Custom", value: "custom" },
];

const EVENT_TRIGGER_OPTIONS = [
  { label: "Post-deployment via CI/CD hook", value: "post_deploy_cicd" },
  { label: "After 10 uses", value: "after_10_uses" },
  { label: "On anomaly detection", value: "anomaly" },
  { label: "5 days before expiry", value: "before_expiry_5d" },
];

const FAILURE_ALERT_OPTIONS = [
  { label: "Email", value: "email" },
  { label: "Teams Notification", value: "teams" },
  { label: "ITSM ticket", value: "itsm" },
];

const DURATION_UNITS = [
  { label: "Days", value: "days" },
  { label: "Months", value: "months" },
  { label: "Years", value: "years" },
];

const ROTATION_METHOD_OPTIONS = [
  { value: "auto" as const, label: "Automatic (vault/secret manager)" },
  { value: "jit" as const, label: "JIT/Dynamic (short TTL)" },
  { value: "semi" as const, label: "Semi-auto (owner approval)" },
  { value: "manual" as const, label: "Manual (audit trail)" },
];

const SCOPE_EXPRESSION_ATTRIBUTES = [
  { label: "Tags", value: "tags" },
  { label: "Environment", value: "environment" },
  { label: "Cloud provider", value: "cloud_provider" },
  { label: "Owner", value: "owner" },
  { label: "Risk score", value: "risk_score" },
];

/** Ensures menus render after hydration so `document.body` exists (avoids SSR/client mismatch). */
function useSelectMenuPortalTarget(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.body);
  }, []);
  return el;
}

const rotationSelectStyles: StylesConfig<{ label: string; value: string }, boolean> = {
  container: (base) => ({ ...base, width: "100%" }),
  control: (base) => ({
    ...base,
    minHeight: "38px",
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
    color: "#111827",
  }),
  menuPortal: (base) => ({ ...base, zIndex: 10000 }),
  menu: (base) => ({
    ...base,
    zIndex: 10000,
    backgroundColor: "#ffffff",
  }),
  menuList: (base) => ({ ...base, backgroundColor: "#ffffff" }),
  option: (base, state) => ({
    ...base,
    color: "#111827",
    backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#f3f4f6" : "#ffffff",
  }),
  singleValue: (base) => ({ ...base, color: "#111827" }),
  multiValue: (base) => ({ ...base, backgroundColor: "#e5e7eb" }),
  multiValueLabel: (base) => ({ ...base, color: "#111827" }),
  input: (base) => ({ ...base, color: "#111827" }),
  placeholder: (base) => ({ ...base, color: "#6b7280" }),
};

type RotationPolicyFormValues = FieldValues & {
  name: string;
  description: string;
  owner: string;
  credentialTypes: MultiValue<{ label: string; value: string }>;
  priority: string;
  nhiTypes: MultiValue<{ label: string; value: string }>;
  scopeExceptions: string;
  showAdvancedScope: boolean;
  advancedConditions: unknown[];
  frequencyValue: string;
  frequencyUnit: string;
  eventTriggeredEnabled: boolean;
  eventTriggeredOption: { label: string; value: string } | null;
  maxAgeEnabled: boolean;
  maxAgeValue: string;
  maxAgeUnit: string;
  rotationMethod: "auto" | "jit" | "semi" | "manual";
  rotationWindowEnabled: boolean;
  windowStart: string;
  windowEnd: string;
  blackoutStart: string;
  blackoutEnd: string;
  retryEnabled: boolean;
  retryMax: string;
  preRotationDays: string;
  failureAlerts: MultiValue<{ label: string; value: string }>;
  recipientOwner: boolean;
  recipientIamAdmin: boolean;
};

function rowFieldMap(row: Record<string, unknown>): Map<string, string> {
  return new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
}

function getRowField(row: Record<string, unknown>, ...names: string[]): unknown {
  const m = rowFieldMap(row);
  for (const n of names) {
    const k = m.get(n.toLowerCase());
    if (k !== undefined) return row[k];
  }
  return undefined;
}

function strRow(row: Record<string, unknown>, ...names: string[]): string {
  const v = getRowField(row, ...names);
  if (v == null) return "";
  return String(v).trim();
}

function parsePgTextArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v !== "string") return [];
  const t = v.trim();
  if (!t) return [];
  if (t.startsWith("{") && t.endsWith("}")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => s.trim()).filter(Boolean);
  }
  try {
    const p = JSON.parse(t) as unknown;
    if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    /* ignore */
  }
  return t.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function boolRow(row: Record<string, unknown>, ...names: string[]): boolean {
  const v = getRowField(row, ...names);
  if (v === true || v === "true" || v === "t" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === "f" || v === 0 || v === "0") return false;
  return Boolean(v);
}

function optBoolRow(row: Record<string, unknown>, fallback: boolean, ...names: string[]): boolean {
  const v = getRowField(row, ...names);
  if (v === undefined) return fallback;
  return boolRow(row, ...names);
}

function numRowStr(row: Record<string, unknown>, fallback: string, ...names: string[]): string {
  const v = getRowField(row, ...names);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return String(Number(v));
  return fallback;
}

const NHI_SCOPE_VALUE_ALIASES: Record<string, string> = {
  agent: "ai_agent",
  ai_agent: "ai_agent",
  managed_identity: "workload",
  workload_container: "workload",
  workload: "workload",
};

function nhiTokenToSelectOption(token: string): { label: string; value: string } {
  const raw = token.trim().toLowerCase();
  const value = NHI_SCOPE_VALUE_ALIASES[raw] ?? raw;
  const opt = NHI_TYPE_OPTIONS.find((o) => o.value === value);
  if (opt) return opt;
  const label = raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { label, value: raw.replace(/\s+/g, "_") };
}

function apiCredentialToFormCategory(token: string): string | null {
  const n = token.trim().toLowerCase();
  if (["password", "database_password"].includes(n)) return "passwords";
  if (["oauth_token", "bearer_token"].includes(n)) return "tokens";
  if (["tls_certificate", "certificate"].includes(n)) return "certs";
  if (["api_key", "hmac_key", "oauth_client_secret"].includes(n)) return "keys";
  if (n.includes("cert")) return "certs";
  if (n.includes("token")) return "tokens";
  if (n.includes("password")) return "passwords";
  if (n) return "keys";
  return null;
}

function parseScopeExpression(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v) as unknown;
      if (Array.isArray(p)) return p;
      if (p && typeof p === "object" && p !== null && "conditions" in p) {
        const c = (p as { conditions?: unknown }).conditions;
        if (Array.isArray(c)) return c;
      }
    } catch {
      return [];
    }
  }
  return [];
}

function mapApiRotationMethod(raw: string | undefined): RotationPolicyFormValues["rotationMethod"] {
  const k = (raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (k === "jit_dynamic" || k === "jit") return "jit";
  if (k === "semi_auto" || k === "semi") return "semi";
  if (k === "manual") return "manual";
  if (k === "automatic" || k === "auto") return "auto";
  return "auto";
}

function normalizeDurationUnit(raw: string | undefined, fallback: string): string {
  const u = (raw ?? "").trim().toLowerCase();
  if (u === "day" || u === "days") return "days";
  if (u === "month" || u === "months") return "months";
  if (u === "year" || u === "years") return "years";
  return fallback;
}

function coerceTimeInput(raw: string, fallback: string): string {
  const s = raw.trim();
  if (!s) return fallback;
  if (/^\d{1,2}:\d{2}(:\d{2})?/.test(s)) {
    const parts = s.split(":");
    const hh = parts[0]?.padStart(2, "0") ?? "09";
    const mm = parts[1]?.padStart(2, "0") ?? "00";
    return `${hh.slice(-2)}:${mm.slice(-2)}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(11, 16);
  }
  return fallback;
}

function coerceDateInput(raw: string, fallback: string): string {
  const s = raw.trim();
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return fallback;
}

function parseFailureAlerts(
  v: unknown,
  fallback: MultiValue<{ label: string; value: string }>,
): MultiValue<{ label: string; value: string }> {
  const tokens = parsePgTextArray(v);
  if (tokens.length === 0 && typeof v === "string" && v.trim().startsWith("[")) {
    try {
      const p = JSON.parse(v) as unknown;
      if (Array.isArray(p)) {
        for (const x of p) tokens.push(String(x));
      }
    } catch {
      /* ignore */
    }
  }
  if (tokens.length === 0) return fallback;
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const value = t.trim().toLowerCase().replace(/\s+/g, "_");
    const opt = FAILURE_ALERT_OPTIONS.find((o) => o.value === value);
    if (opt && !seen.has(opt.value)) {
      seen.add(opt.value);
      out.push(opt);
    }
  }
  return out.length > 0 ? out : fallback;
}

function mapDetailRowToFormValues(
  row: Record<string, unknown>,
  blank: RotationPolicyFormValues,
): RotationPolicyFormValues {
  const credTokens = parsePgTextArray(getRowField(row, "credential_types"));
  const credCategories = new Set<string>();
  for (const t of credTokens) {
    const cat = apiCredentialToFormCategory(t);
    if (cat) credCategories.add(cat);
  }
  const credentialTypes: MultiValue<{ label: string; value: string }> =
    credCategories.size > 0
      ? (Array.from(credCategories)
          .map((v) => CREDENTIAL_TYPE_OPTIONS.find((o) => o.value === v))
          .filter(Boolean) as MultiValue<{ label: string; value: string }>)
      : blank.credentialTypes;

  const scopeTokens = parsePgTextArray(getRowField(row, "scope_nhi_types", "nhi_types"));
  const nhiTypes: MultiValue<{ label: string; value: string }> =
    scopeTokens.length > 0 ? scopeTokens.map(nhiTokenToSelectOption) : blank.nhiTypes;

  const advancedRaw = getRowField(row, "scope_expression", "advanced_conditions", "condition_expression");
  const advancedConditions = parseScopeExpression(advancedRaw);

  const eventCode = strRow(row, "event_trigger_type", "event_trigger", "trigger_type").toLowerCase();
  let eventTriggeredOption: RotationPolicyFormValues["eventTriggeredOption"] =
    EVENT_TRIGGER_OPTIONS.find((o) => o.value === eventCode) ?? null;
  const eventTriggeredEnabled = boolRow(row, "event_triggered", "event_trigger_enabled");
  if (eventTriggeredEnabled && !eventTriggeredOption) {
    eventTriggeredOption = EVENT_TRIGGER_OPTIONS[2];
  }

  return {
    ...blank,
    name: strRow(row, "name", "policy_name") || blank.name,
    description: strRow(row, "description", "policy_description") || blank.description,
    owner: strRow(row, "owner", "owner_name", "last_modified_by", "business_owner") || blank.owner,
    credentialTypes,
    priority: numRowStr(row, blank.priority, "priority", "sort_priority"),
    nhiTypes,
    scopeExceptions: strRow(row, "scope_exceptions", "exceptions", "exceptions_note") || blank.scopeExceptions,
    showAdvancedScope: advancedConditions.length > 0,
    advancedConditions,
    frequencyValue: numRowStr(row, blank.frequencyValue, "frequency_value", "rotation_frequency_value"),
    frequencyUnit: normalizeDurationUnit(
      strRow(row, "frequency_unit", "rotation_frequency_unit") || undefined,
      blank.frequencyUnit,
    ),
    eventTriggeredEnabled,
    eventTriggeredOption,
    maxAgeEnabled: optBoolRow(row, blank.maxAgeEnabled, "max_age_enabled"),
    maxAgeValue: numRowStr(row, blank.maxAgeValue, "max_age_value"),
    maxAgeUnit: normalizeDurationUnit(
      strRow(row, "max_age_unit") || undefined,
      blank.maxAgeUnit,
    ),
    rotationMethod: mapApiRotationMethod(strRow(row, "rotation_method", "rotation_mode")),
    rotationWindowEnabled: optBoolRow(row, blank.rotationWindowEnabled, "rotation_window_enabled", "window_enabled"),
    windowStart: coerceTimeInput(
      strRow(row, "rotation_window_start", "window_start", "exec_window_start"),
      blank.windowStart,
    ),
    windowEnd: coerceTimeInput(
      strRow(row, "rotation_window_end", "window_end", "exec_window_end"),
      blank.windowEnd,
    ),
    blackoutStart: coerceDateInput(
      strRow(row, "blackout_start", "blackout_period_start"),
      blank.blackoutStart,
    ),
    blackoutEnd: coerceDateInput(strRow(row, "blackout_end", "blackout_period_end"), blank.blackoutEnd),
    retryEnabled: optBoolRow(row, blank.retryEnabled, "retry_enabled", "retry_logic_enabled"),
    retryMax: numRowStr(row, blank.retryMax, "retry_max", "retry_max_attempts"),
    preRotationDays: numRowStr(row, blank.preRotationDays, "pre_rotation_days", "reminder_days"),
    failureAlerts: parseFailureAlerts(
      getRowField(row, "failure_alert_channels", "failure_alerts", "notification_channels"),
      blank.failureAlerts,
    ),
    recipientOwner: optBoolRow(row, blank.recipientOwner, "notify_owner", "recipient_owner"),
    recipientIamAdmin: optBoolRow(row, blank.recipientIamAdmin, "notify_iam_admin", "recipient_iam_admin"),
  };
}

function buildNewPolicyDefaults(): RotationPolicyFormValues {
  return {
    name: "",
    description: "",
    owner: "",
    credentialTypes: [CREDENTIAL_TYPE_OPTIONS[1], CREDENTIAL_TYPE_OPTIONS[2]],
    priority: "100",
    nhiTypes: [NHI_TYPE_OPTIONS[1]],
    scopeExceptions: "",
    showAdvancedScope: false,
    advancedConditions: [],
    frequencyValue: "90",
    frequencyUnit: "days",
    eventTriggeredEnabled: false,
    eventTriggeredOption: null,
    maxAgeEnabled: true,
    maxAgeValue: "365",
    maxAgeUnit: "days",
    rotationMethod: "auto",
    rotationWindowEnabled: false,
    windowStart: "09:00",
    windowEnd: "17:00",
    blackoutStart: "",
    blackoutEnd: "",
    retryEnabled: true,
    retryMax: "3",
    preRotationDays: "7",
    failureAlerts: [FAILURE_ALERT_OPTIONS[0]],
    recipientOwner: true,
    recipientIamAdmin: true,
  };
}

function ExpandableSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/80"
      >
        <span className="text-base font-semibold text-gray-900">{title}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-4 border-t border-gray-100 px-4 py-4">{children}</div>}
    </section>
  );
}

function ToggleRow({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description ? <p className="text-xs text-gray-500">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          } mt-0.5`}
        />
      </button>
    </div>
  );
}

export function RotationPolicyEditorPage({ policyId }: { policyId?: string }) {
  const menuPortalTarget = useSelectMenuPortalTarget();
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(policyId));

  const blankDefaults = useMemo(() => buildNewPolicyDefaults(), []);

  const { control, register, handleSubmit, watch, setValue, reset } = useForm<RotationPolicyFormValues>({
    defaultValues: blankDefaults,
  });

  const applyDetailRow = useCallback(
    (row: Record<string, unknown>) => {
      reset(mapDetailRowToFormValues(row, buildNewPolicyDefaults()));
    },
    [reset],
  );

  useEffect(() => {
    if (!policyId) {
      setLoadError(null);
      setDetailLoading(false);
      reset(buildNewPolicyDefaults());
      return;
    }

    let cancelled = false;
    setLoadError(null);
    setDetailLoading(true);

    void (async () => {
      try {
        const response = await executeQuery<unknown>(ROTATION_POLICY_BY_ID_QUERY, [policyId]);
        if (cancelled) return;
        const row = extractRotationPolicyDetailRow(response);
        if (!row) {
          setLoadError("Policy not found.");
          reset(buildNewPolicyDefaults());
          return;
        }
        applyDetailRow(row);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load policy");
        reset(buildNewPolicyDefaults());
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [policyId, reset, applyDetailRow]);

  const showAdvanced = watch("showAdvancedScope");
  const eventOn = watch("eventTriggeredEnabled");
  const maxAgeOn = watch("maxAgeEnabled");
  const windowOn = watch("rotationWindowEnabled");
  const retryOn = watch("retryEnabled");

  const onSaveDraft = handleSubmit((data) => {
    console.info("Save as draft", data);
    router.push("/non-human-identity/rotation-policy");
  });

  const onPublish = handleSubmit((data) => {
    console.info("Publish & enforce", data);
    router.push("/non-human-identity/rotation-policy");
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {policyId ? "Edit policy" : "Build new policy"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure scope, rotation mechanics, execution windows, and notifications.
              {policyId ? " Policy details are loaded from the server when you open this page." : ""}
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
        ) : null}

        {detailLoading ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Loading policy…
          </div>
        ) : null}

        <div className={`space-y-4 ${detailLoading ? "pointer-events-none opacity-60" : ""}`}>
          <ExpandableSection title="1. General" defaultOpen>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  {...register("name", { required: true })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Unique policy name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Owner</label>
                <input
                  {...register("owner")}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Team or individual accountable for this policy"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Rich text: explain intent, exceptions, and links to runbooks."
                />
                <p className="text-xs text-gray-500">
                  Use paragraphs and bullets as needed; full rich-text editing can be wired later.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Credential types supported</label>
                <Controller
                  name="credentialTypes"
                  control={control}
                  render={({ field }) => (
                    <Select<{ label: string; value: string }, true>
                      {...field}
                      isMulti
                      options={CREDENTIAL_TYPE_OPTIONS}
                      styles={rotationSelectStyles}
                      menuPortalTarget={menuPortalTarget ?? undefined}
                      menuPosition="fixed"
                      placeholder="Select one or more"
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Priority (overlapping policies)</label>
                <input
                  {...register("priority")}
                  type="number"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <p className="text-xs text-gray-500">Higher number wins when multiple policies match.</p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Scope — NHI types</span>
                <Controller
                  name="nhiTypes"
                  control={control}
                  render={({ field }) => (
                    <Select<{ label: string; value: string }, true>
                      {...field}
                      isMulti
                      options={NHI_TYPE_OPTIONS}
                      styles={rotationSelectStyles}
                      menuPortalTarget={menuPortalTarget ?? undefined}
                      menuPosition="fixed"
                      placeholder="Select NHI types"
                    />
                  )}
                />
                <div className="space-y-2 pt-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="scope-exceptions">
                    Exceptions
                  </label>
                  <input
                    id="scope-exceptions"
                    {...register("scopeExceptions")}
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="e.g., exempt specific high-availability NHIs"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="min-w-0 pt-3 lg:pt-4">
                <Controller
                  name="showAdvancedScope"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      label="Advanced condition builder"
                      description="Tags, environment, cloud, owner, risk."
                      enabled={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
            {showAdvanced && (
              <div className="mt-3 rounded-md border border-dashed border-gray-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Advanced conditions</p>
                <ExpressionBuilder
                  title=""
                  control={control as unknown as Control<FieldValues>}
                  setValue={setValue as unknown as UseFormSetValue<FieldValues>}
                  watch={watch as unknown as UseFormWatch<FieldValues>}
                  fieldName="advancedConditions"
                  attributesOptions={SCOPE_EXPRESSION_ATTRIBUTES}
                  hideJsonPreview
                  fullWidth
                />
              </div>
            )}
          </ExpandableSection>

          <ExpandableSection title="2. Rotation rules" defaultOpen>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Frequency — value</label>
                  <input
                    {...register("frequencyValue")}
                    type="number"
                    min={1}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Frequency — unit</label>
                  <select
                    {...register("frequencyUnit")}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {DURATION_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="min-w-0">
                <Controller
                  name="eventTriggeredEnabled"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      label="Event-triggered rotation"
                      description="Also rotate on runtime events."
                      enabled={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              {eventOn && (
                <div className="max-w-xl space-y-2">
                  <label className="text-sm font-medium text-gray-700">Event trigger</label>
                  <Controller
                    name="eventTriggeredOption"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={EVENT_TRIGGER_OPTIONS}
                        styles={rotationSelectStyles}
                        menuPortalTarget={menuPortalTarget ?? undefined}
                        menuPosition="fixed"
                        placeholder="Select trigger"
                      />
                    )}
                  />
                </div>
              )}

              <div className="min-w-0">
                <Controller
                  name="maxAgeEnabled"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      label="Max credential age"
                      description="Cap lifetime before forced rotation."
                      enabled={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              {maxAgeOn && (
                <div className="grid max-w-xl grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Max age — value</label>
                    <input
                      {...register("maxAgeValue")}
                      type="number"
                      min={1}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Max age — unit</label>
                    <select
                      {...register("maxAgeUnit")}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      {DURATION_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Rotation method</span>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Rotation method">
                  {ROTATION_METHOD_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:ring-1 has-[:checked]:ring-blue-500/30"
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        {...register("rotationMethod")}
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection title="3. Execution settings" defaultOpen>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Controller
                  name="rotationWindowEnabled"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      label="Rotation window"
                      description="Limit rotations to a daily time range."
                      enabled={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {windowOn && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Window start</label>
                      <input
                        {...register("windowStart")}
                        type="time"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Window end</label>
                      <input
                        {...register("windowEnd")}
                        type="time"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3 lg:border-l lg:border-gray-100 lg:pl-4">
                <span className="text-sm font-medium text-gray-700">Blackout period</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Start</label>
                    <input
                      {...register("blackoutStart")}
                      type="date"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">End</label>
                    <input
                      {...register("blackoutEnd")}
                      type="date"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
                <Controller
                  name="retryEnabled"
                  control={control}
                  render={({ field }) => (
                    <ToggleRow
                      label="Retry logic"
                      description="Retry failed rotations."
                      enabled={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {retryOn ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Max attempts</label>
                    <input
                      {...register("retryMax")}
                      type="number"
                      min={1}
                      className="w-full max-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection title="4. Notifications & monitoring" defaultOpen>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Pre-rotation reminders (days before)</label>
                <input
                  {...register("preRotationDays")}
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Failure alerts</label>
                <Controller
                  name="failureAlerts"
                  control={control}
                  render={({ field }) => (
                    <Select<{ label: string; value: string }, true>
                      {...field}
                      isMulti
                      options={FAILURE_ALERT_OPTIONS}
                      styles={rotationSelectStyles}
                      menuPortalTarget={menuPortalTarget ?? undefined}
                      menuPosition="fixed"
                      placeholder="Select channels"
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Recipients</span>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input type="checkbox" {...register("recipientOwner")} className="h-4 w-4 rounded border-gray-300" />
                    Owner
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      {...register("recipientIamAdmin")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    IAM Admin
                  </label>
                </div>
              </div>
            </div>
          </ExpandableSection>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <div className="flex w-full flex-wrap items-center justify-end gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            href="/non-human-identity/rotation-policy"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={onSaveDraft}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Save as draft
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Publish &amp; enforce
          </button>
        </div>
      </div>
    </div>
  );
}
