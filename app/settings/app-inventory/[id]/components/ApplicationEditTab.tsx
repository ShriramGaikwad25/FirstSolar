"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import {
  getApplicationDetails,
  getAllSupportedApplicationTypesViaProxy,
  parseSupportedObjectsApplicationTypeItem,
  partitionApplicationDetailsByIntegrationGroups,
  sortIntegrationFieldGroups,
  isAdvancedIntegrationGroupId,
  type ApplicationTypeIntegrationFieldGroup,
} from "@/lib/api";
import { Check, ChevronDown, ChevronUp, Edit, Settings2, KeyRound } from "lucide-react";
import AdvancedIntegrationOperationTabs from "../../components/AdvancedIntegrationOperationTabs";
import ToggleSwitch from "@/components/ToggleSwitch";

export type ApplicationEditTabHandle = {
  submit: () => Promise<void>;
  cancelEdit: () => void;
  startEdit: () => void;
};

interface ApplicationEditTabProps {
  applicationId: string;
  /** Called after successful submit (e.g. navigate back to inventory). If not provided, uses router.push("/settings/app-inventory"). */
  onBackToInventory?: () => void;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** When true, Edit/Cancel/Submit are not rendered inside the tab (e.g. header toolbar). */
  hideToolbar?: boolean;
}

/** Match API keys like Password, admin_password, PWD, Passphrase, etc. */
function fieldKeyLooksSensitive(field: string): boolean {
  const n = field.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/_/g, "");
  return (
    /password|passwd|secret|token|passphrase|credential|apikey|privatekey|clientsecret|adminpassword|refreshtoken|accesstoken|authorization/i.test(
      n
    ) ||
    n === "pwd"
  );
}

function labelLooksLikePasswordOnly(label: string): boolean {
  const base = label.replace(/:\s*$/, "").trim().toLowerCase();
  return base === "password" || /\bpassword\b/.test(base);
}

function scalarEditValue(value: unknown): { text: string; isScalar: boolean } {
  if (value == null) {
    return { text: JSON.stringify(value ?? "", null, 2), isScalar: false };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { text: String(value), isScalar: true };
  }
  if (typeof value === "object" && value instanceof String) {
    return { text: String(value), isScalar: true };
  }
  return { text: JSON.stringify(value ?? "", null, 2), isScalar: false };
}

/** Plaintext for secret inputs: APIs may return strings, numbers, or (rarely) char arrays. */
function coerceSecretPlaintext(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && value instanceof String) {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (
      value.every((x) => typeof x === "string" || typeof x === "number" || typeof x === "boolean")
    ) {
      return value.map((x) => String(x)).join("");
    }
    return null;
  }
  return null;
}

export default forwardRef<ApplicationEditTabHandle, ApplicationEditTabProps>(
  function ApplicationEditTab(
    {
      applicationId,
      onBackToInventory,
      isEditing: isEditingProp,
      onEditingChange,
      hideToolbar = false,
    },
    ref
  ) {
  const router = useRouter();
  const [appDetails, setAppDetails] = useState<any>(null);
  const [editedApp, setEditedApp] = useState<any | null>(null);
  const [internalEditing, setInternalEditing] = useState(false);
  const isEditing = isEditingProp ?? internalEditing;
  const setIsEditing = (value: boolean) => {
    if (isEditingProp === undefined) setInternalEditing(value);
    onEditingChange?.(value);
  };
  const [secretModal, setSecretModal] = useState<{
    open: boolean;
    label: string;
    value: string;
  }>({
    open: false,
    label: "",
    value: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrationGroups, setIntegrationGroups] = useState<ApplicationTypeIntegrationFieldGroup[]>(
    []
  );
  const [activeConfigGroupIndex, setActiveConfigGroupIndex] = useState(0);
  /** Active Directory Domain: Advanced sub-section expand/collapse (same as add-application). */
  const [adDomainAdvancedExpanded, setAdDomainAdvancedExpanded] = useState(false);
  /** Active Directory Domain: Inherited Global Policies — locked until its own Edit is clicked. */
  const [inheritedPoliciesEditing, setInheritedPoliciesEditing] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!applicationId) return;
      const apiToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`app-inventory-token-${applicationId}`) ?? ""
          : "";
      setIsLoading(true);
      setError(null);
      try {
        const [data, supported] = await Promise.all([
          getApplicationDetails(applicationId, apiToken),
          getAllSupportedApplicationTypesViaProxy().catch(() => null),
        ]);
        setAppDetails(data);
        setEditedApp(data);

        const app = data?.Application ?? data ?? {};
        const category = String(
          app.category ?? app.Category ?? app.applicationType ?? app.ApplicationType ?? ""
        ).trim();

        let groups: ApplicationTypeIntegrationFieldGroup[] = [];
        if (category && supported?.applicationType && Array.isArray(supported.applicationType)) {
          for (const raw of supported.applicationType as unknown[]) {
            const parsed = parseSupportedObjectsApplicationTypeItem(raw);
            if (parsed?.typeName === category && parsed.integrationFieldGroups?.length) {
              groups = sortIntegrationFieldGroups(parsed.integrationFieldGroups);
              break;
            }
          }
        }
        setIntegrationGroups(groups);
        setActiveConfigGroupIndex(0);
      } catch (err) {
        console.error("Error fetching application details:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch application details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [applicationId]);

  const currentData = isEditing ? editedApp : appDetails;
  const application = currentData?.Application ?? currentData;

  const formatLabel = (key: string): string =>
    key
      .replace(/_/g, " ")
      .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  const formatValue = (value: any): string => {
    if (value == null) return "—";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === "object") {
      if (Object.keys(value).length === 0) return "—";
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const isDisplayableValue = (value: any): boolean => true;

  const renderFieldRow = (
    label: string,
    value: any,
    maskPassword: boolean,
    fieldKey?: string,
    editable: boolean = false,
    onChange?: (newValue: string) => void,
    compact: boolean = false
  ) => {
    const isSensitiveField =
      maskPassword ||
      (fieldKey != null &&
        fieldKey !== "" &&
        fieldKeyLooksSensitive(String(fieldKey))) ||
      labelLooksLikePasswordOnly(label);
    const keyIsExactlyPassword =
      fieldKey != null &&
      String(fieldKey).replace(/^\uFEFF/, "").trim().toLowerCase() === "password";

    let displayValue: string;
    if ((isSensitiveField || keyIsExactlyPassword) && value != null && String(value) !== "") {
      displayValue = "••••••••";
    } else {
      displayValue = formatValue(value);
    }
    const isJson = displayValue.startsWith("{") || displayValue.startsWith("[");
    const noScroll = fieldKey?.toLowerCase() === "uniqueidschemamap";

    const fieldShell = compact
      ? "min-w-0 rounded-md border border-gray-100 bg-gray-50/60 px-2 py-2 h-full"
      : "min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3 h-full";
    const labelClass = compact
      ? "text-[11px] font-medium text-gray-500 mb-1"
      : "text-xs font-medium text-gray-500 mb-1.5";
    const valueClass = compact
      ? "text-xs text-gray-900 break-words leading-snug"
      : "text-sm text-gray-900 break-words leading-snug";

    if (editable) {
      const secretPlain = coerceSecretPlaintext(value);
      if ((isSensitiveField || keyIsExactlyPassword) && secretPlain !== null) {
        return (
          <div className={fieldShell}>
            <label className={`block ${labelClass}`}>{label}</label>
            <input
              type="password"
              className="w-full text-xs text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={secretPlain}
              onChange={(e) => onChange?.(e.target.value)}
              autoComplete="off"
            />
          </div>
        );
      }

      const { text: editString } = scalarEditValue(value);
      const editLooksLikeJson =
        !(isSensitiveField || keyIsExactlyPassword) &&
        (editString.startsWith("{") || editString.startsWith("["));

      return (
        <div className={fieldShell}>
          <label className={`block ${labelClass}`}>{label}</label>
          <textarea
            className="w-full text-xs text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical bg-white"
            rows={editLooksLikeJson ? 4 : compact ? 2 : 2}
            value={editString}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      );
    }
    return (
      <div className={fieldShell}>
        <div className={labelClass}>{label}</div>
        {isJson ? (
          <pre
            className={`text-[11px] text-gray-800 bg-white p-2 rounded border border-gray-200 font-mono ${
              noScroll
                ? "overflow-visible whitespace-pre-wrap break-words"
                : "overflow-auto max-h-32"
            }`}
          >
            {displayValue}
          </pre>
        ) : (
          <div className={valueClass}>{displayValue}</div>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    data: any,
    options?: {
      fieldKeys?: string[];
      hideTitle?: boolean;
      sectionKind?: "Application Details" | "OAuth Details";
      compact?: boolean;
      singleColumn?: boolean;
    }
  ) => {
    if (!data || typeof data !== "object") return null;
    const sectionKind = options?.sectionKind ?? (title as "Application Details" | "OAuth Details");
    const compact = options?.compact ?? false;
    const singleColumn = options?.singleColumn ?? false;
    let fields = Object.keys(data).filter((key) => {
      const value = data[key];
      if (
        !isEditing &&
        sectionKind === "OAuth Details" &&
        (key.toLowerCase() === "clientsecret" || key.toLowerCase() === "adminpassword")
      ) {
        return false;
      }
      return isDisplayableValue(value);
    });
    if (options?.fieldKeys) {
      const allowed = new Set(options.fieldKeys);
      fields = fields.filter((key) => allowed.has(key));
      if (options.fieldKeys.length > 0) {
        fields.sort((a, b) => options.fieldKeys!.indexOf(a) - options.fieldKeys!.indexOf(b));
      }
    }
    if (fields.length === 0) {
      return (
        <div className="flex flex-col h-full">
          {!options?.hideTitle && (
            <h2
              className={
                compact
                  ? "text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200"
                  : "text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200"
              }
            >
              {title}
            </h2>
          )}
          <p className="text-sm text-gray-500 py-4">No fields configured for this section.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        {!options?.hideTitle && (
          <h2
            className={
              compact
                ? "text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200"
                : "text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200"
            }
          >
            {title}
          </h2>
        )}
        <div
          className={
            singleColumn
              ? "grid grid-cols-1 gap-3 items-start"
              : compact
                ? "grid grid-cols-1 gap-2 items-start"
                : "grid grid-cols-2 gap-4 items-start"
          }
        >
          {fields.map((field) => {
            const value = data[field];
            const fieldLower = field.toLowerCase();
            const label = formatLabel(field);
            const maskPassword =
              fieldKeyLooksSensitive(field) || labelLooksLikePasswordOnly(label);

            if (
              isEditing &&
              sectionKind === "OAuth Details" &&
              (fieldLower === "clientsecret" || fieldLower === "adminpassword")
            ) {
              const buttonLabel =
                fieldLower === "clientsecret" ? "Client Secret" : "Admin Password";
              return (
                <div
                  key={field}
                  className="col-span-2 min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-medium transition-colors"
                      onClick={() => {
                        const rootApp = (editedApp ?? appDetails)?.Application ??
                          (editedApp ?? appDetails);
                        const oauth =
                          rootApp?.OAuthDetails ?? rootApp?.oauthDetails ?? {};
                        const rawValue =
                          fieldLower === "clientsecret"
                            ? oauth.clientSecret ?? oauth.ClientSecret ?? ""
                            : oauth.adminPassword ?? oauth.AdminPassword ?? "";
                        setSecretModal({
                          open: true,
                          label: buttonLabel,
                          value: rawValue ?? "",
                        });
                      }}
                    >
                      {`Show ${buttonLabel}`}
                    </button>
                  </div>
                </div>
              );
            }

            const handleChange =
              isEditing && editedApp
                ? (newValue: string) => {
                    setEditedApp((prev: any) => {
                      if (!prev) return prev;
                      const updated = { ...prev };
                      const rootApp = updated.Application ?? updated;

                      if (sectionKind === "Application Details") {
                        const detailsKey =
                          "ApplicationDetails" in rootApp
                            ? "ApplicationDetails"
                            : "applicationDetails";
                        const details = { ...(rootApp[detailsKey] || {}) };
                        details[field] = newValue;
                        rootApp[detailsKey] = details;
                      } else if (sectionKind === "OAuth Details") {
                        const oauthKey =
                          "OAuthDetails" in rootApp ? "OAuthDetails" : "oauthDetails";
                        const oauth = { ...(rootApp[oauthKey] || {}) };
                        oauth[field] = newValue;
                        rootApp[oauthKey] = oauth;
                      }

                      if (updated.Application) {
                        updated.Application = rootApp;
                      } else {
                        Object.assign(updated, rootApp);
                      }
                      return updated;
                    });
                  }
                : undefined;

            return (
              <React.Fragment key={field}>
                {renderFieldRow(label, value, maskPassword, field, isEditing, handleChange, compact)}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const applicationDetails =
    application?.ApplicationDetails ?? application?.applicationDetails ?? {};

  const appType = String(
    application?.category ??
      application?.Category ??
      application?.applicationType ??
      application?.ApplicationType ??
      ""
  ).trim();

  /** Same update mechanism renderSection() uses per-field, exposed for the AD Domain custom fields (select/checkbox/toggle) below. */
  const updateAppDetailField = (field: string, newValue: any) => {
    setEditedApp((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      const rootApp = updated.Application ?? updated;
      const detailsKey = "ApplicationDetails" in rootApp ? "ApplicationDetails" : "applicationDetails";
      const details = { ...(rootApp[detailsKey] || {}) };
      details[field] = newValue;
      rootApp[detailsKey] = details;
      if (updated.Application) {
        updated.Application = rootApp;
      } else {
        Object.assign(updated, rootApp);
      }
      return updated;
    });
  };

  const adFieldShell = "min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3 h-full";
  const adLabelClass = "text-xs font-medium text-gray-500 mb-1.5";

  /** Read-only or editable label+value cell for the AD Domain select/checkbox/toggle fields (renderFieldRow only supports text). */
  const renderAdCustomField = (label: string, editingControl: React.ReactNode, displayValue: string) => (
    <div className={adFieldShell}>
      <div className={adLabelClass}>{label}</div>
      {isEditing ? editingControl : <div className="text-sm text-gray-900 break-words leading-snug">{displayValue}</div>}
    </div>
  );

  const renderActiveDirectoryDomainConfig = () => {
    const d = applicationDetails;
    return (
      <div className="flex flex-col min-w-0 w-full space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 pb-2 border-b border-gray-200">
          Active Directory Domain Settings
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {renderFieldRow("Hostname", d.hostname, false, "hostname", isEditing, (v) => updateAppDetailField("hostname", v))}
          {renderFieldRow("UserName", d.username, false, "username", isEditing, (v) => updateAppDetailField("username", v))}
          {renderFieldRow("Password", d.password, true, "password", isEditing, (v) => updateAppDetailField("password", v))}
          {renderFieldRow("Domain", d.domain, false, "domain", isEditing, (v) => updateAppDetailField("domain", v))}
        </div>
        {renderFieldRow("Backup Hostname", d.backupHostname, false, "backupHostname", isEditing, (v) => updateAppDetailField("backupHostname", v))}

        <div style={{ border: "1px solid #e5e7eb", borderLeft: "4px solid #c4b5fd", borderRadius: 8, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setAdDomainAdvancedExpanded((e) => !e)}
            aria-expanded={adDomainAdvancedExpanded}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px",
              minHeight: 56,
              textAlign: "left",
              background: "#f9fafb",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Advanced</span>
            {adDomainAdvancedExpanded ? (
              <ChevronUp style={{ width: 20, height: 20, color: "#2563eb", flexShrink: 0 }} aria-hidden />
            ) : (
              <ChevronDown style={{ width: 20, height: 20, color: "#2563eb", flexShrink: 0 }} aria-hidden />
            )}
          </button>
          {adDomainAdvancedExpanded && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {renderFieldRow(
                  "Domain Controller",
                  d.primaryDomainController,
                  false,
                  "primaryDomainController",
                  isEditing,
                  (v) => updateAppDetailField("primaryDomainController", v)
                )}
                {renderAdCustomField(
                  "Port / SSL",
                  <select
                    value={d.portSsl ?? ""}
                    onChange={(e) => updateAppDetailField("portSsl", e.target.value)}
                    className="w-full text-xs text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value=""></option>
                    <option value="389 - LDAP">389 - LDAP</option>
                    <option value="636 - LDAPS">636 - LDAPS</option>
                  </select>,
                  d.portSsl || "—"
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderAdCustomField(
                  "Vault",
                  <select
                    value={d.vault ?? ""}
                    onChange={(e) => updateAppDetailField("vault", e.target.value)}
                    className="w-full text-xs text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value=""></option>
                    <option value="DPW-Dubai-CyberArk">DPW-Dubai-CyberArk</option>
                    <option value="US-AD-OCI-Vault">US-AD-OCI-Vault</option>
                    <option value="NA-Shared-CyberArk">NA-Shared-CyberArk</option>
                    <option value="UK-HashiCorp-Vault">UK-HashiCorp-Vault</option>
                  </select>,
                  d.vault || "—"
                )}
                {renderFieldRow("Secret Path", d.secretPath, false, "secretPath", isEditing, (v) => updateAppDetailField("secretPath", v))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderFieldRow(
                  "User Search Base",
                  d.userSearchBase,
                  false,
                  "userSearchBase",
                  isEditing,
                  (v) => updateAppDetailField("userSearchBase", v)
                )}
                {renderFieldRow(
                  "Group Search Base",
                  d.groupSearchBase,
                  false,
                  "groupSearchBase",
                  isEditing,
                  (v) => updateAppDetailField("groupSearchBase", v)
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderFieldRow("Deleted OU", d.deletedOu, false, "deletedOu", isEditing, (v) => updateAppDetailField("deletedOu", v))}
                {renderFieldRow("Contact OU", d.contactOu, false, "contactOu", isEditing, (v) => updateAppDetailField("contactOu", v))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderFieldRow("Vault Name", d.vaultName, false, "vaultName", isEditing, (v) => updateAppDetailField("vaultName", v))}
                {renderFieldRow("Vault Path", d.vaultPath, false, "vaultPath", isEditing, (v) => updateAppDetailField("vaultPath", v))}
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
                      value={d.inheritedPort ?? "636"}
                      onChange={(e) => updateAppDetailField("inheritedPort", e.target.value)}
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
                      checked={d.inheritedSslEnabled ?? true}
                      onChange={(v) => updateAppDetailField("inheritedSslEnabled", v)}
                      disabled={!inheritedPoliciesEditing}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px" }}>
                    <span style={{ fontSize: 14, color: "#4b5563" }}>Delete account on delete request</span>
                    <ToggleSwitch
                      checked={d.inheritedDeleteAcctOnDeleteRequest ?? false}
                      onChange={(v) => updateAppDetailField("inheritedDeleteAcctOnDeleteRequest", v)}
                      disabled={!inheritedPoliciesEditing}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px" }}>
                    <span style={{ fontSize: 14, color: "#4b5563" }}>Revoke membership</span>
                    <ToggleSwitch
                      checked={d.inheritedRevokeMembership ?? true}
                      onChange={(v) => updateAppDetailField("inheritedRevokeMembership", v)}
                      disabled={!inheritedPoliciesEditing}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px 12px", gridColumn: "1 / -1" }}>
                    <span style={{ fontSize: 14, color: "#4b5563" }}>Primary Identity Attribute</span>
                    <input
                      type="text"
                      value={d.inheritedPrimaryIdentityAttribute ?? "samaccountname"}
                      onChange={(e) => updateAppDetailField("inheritedPrimaryIdentityAttribute", e.target.value)}
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
      </div>
    );
  };

  const { groupedFields, ungroupedFieldKeys } = partitionApplicationDetailsByIntegrationGroups(
    applicationDetails,
    integrationGroups
  );

  const hasGroupedConfig = integrationGroups.length > 0;
  const activeGroupEntry =
    hasGroupedConfig && groupedFields[activeConfigGroupIndex]
      ? groupedFields[activeConfigGroupIndex]
      : null;

  const renderConfigurationPanel = () => {
    if (appType === "Active Directory Domain") {
      return renderActiveDirectoryDomainConfig();
    }
    if (!hasGroupedConfig) {
      return renderSection("Application Details", applicationDetails, {
        sectionKind: "Application Details",
        hideTitle: true,
      });
    }

    return (
      <div className="flex flex-col h-full min-w-0 w-full">
        <div className="flex flex-wrap gap-2 mb-5 border-b border-gray-200 pb-3">
          {groupedFields.map(({ group }, index) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveConfigGroupIndex(index)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeConfigGroupIndex === index
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {group.label}
            </button>
          ))}
          {ungroupedFieldKeys.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveConfigGroupIndex(groupedFields.length)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeConfigGroupIndex === groupedFields.length
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Other
            </button>
          )}
        </div>
        {activeConfigGroupIndex < groupedFields.length && activeGroupEntry ? (
          isAdvancedIntegrationGroupId(activeGroupEntry.group.id) ? (
            <AdvancedIntegrationOperationTabs
              fieldKeys={activeGroupEntry.fieldKeys}
              renderFields={(keys) =>
                renderSection(activeGroupEntry.group.label, applicationDetails, {
                  fieldKeys: keys,
                  hideTitle: true,
                  sectionKind: "Application Details",
                })
              }
            />
          ) : (
            renderSection(activeGroupEntry.group.label, applicationDetails, {
              fieldKeys: activeGroupEntry.fieldKeys,
              hideTitle: true,
              sectionKind: "Application Details",
            })
          )
        ) : (
          renderSection("Other", applicationDetails, {
            fieldKeys: ungroupedFieldKeys,
            hideTitle: true,
            sectionKind: "Application Details",
          })
        )}
      </div>
    );
  };

  const handleSubmit = async () => {
    try {
      const source = editedApp ?? appDetails;
      if (!source) return;

      const rootApp = source.Application ?? source;
      const appId = rootApp.ApplicationID ?? applicationId;

      if (!appId) {
        console.error("Missing ApplicationID for updateApp");
        return;
      }

      const applicationDetails = {
        ...(rootApp.ApplicationDetails ?? rootApp.applicationDetails ?? {}),
      };
      const oauthDetails = {
        ...(rootApp.OAuthDetails ?? rootApp.oauthDetails ?? {}),
      };

      const oldToken =
        (typeof window !== "undefined"
          ? (sessionStorage.getItem(`app-inventory-token-${appId}`) ?? "")
          : "") ||
        (rootApp.APIToken ??
        rootApp.apiToken ??
        rootApp.OldAPIToken ??
        rootApp.oldApiToken ??
        "");

      const payload: any = {
        ApplicationDetails: applicationDetails,
        OAuthDetails: oauthDetails,
      };
      if (oldToken) {
        payload.OldAPIToken = oldToken;
      }

      const url = `https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/updateApp/${encodeURIComponent(appId)}`;

      const resp = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        console.error("updateApp failed", await resp.text());
        return;
      }

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }
      if (data && typeof data === "object") {
        setAppDetails((prev: any) => {
          const next = { ...(prev ?? {}) };
          if (data.Application) {
            next.Application = data.Application;
          } else {
            Object.assign(next, data);
          }
          return next;
        });
      } else {
        setAppDetails(editedApp);
      }

      setIsEditing(false);
      if (onBackToInventory) {
        onBackToInventory();
      } else {
        router.push("/settings/app-inventory");
      }
    } catch (e) {
      console.error("Error calling updateApp API", e);
    }
  };

  const handleRegenerateSecret = async () => {
    try {
      const source = editedApp ?? appDetails;
      const rootApp = source?.Application ?? source;
      const appId = rootApp?.ApplicationID ?? applicationId;
      const oauth =
        rootApp?.OAuthDetails ?? rootApp?.oauthDetails ?? {};
      const clientID = oauth.clientID ?? oauth.ClientID ?? "";

      if (!appId || !clientID) {
        console.error("Missing ApplicationID or clientID for regenerateClientSecret");
        return;
      }

      const url = `https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/regenerateClientSecret/${encodeURIComponent(appId)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientID }),
      });

      if (!resp.ok) {
        console.error("regenerateClientSecret failed", await resp.text());
        return;
      }

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      const newSecret =
        data?.clientSecret ??
        data?.ClientSecret ??
        data?.newClientSecret ??
        data?.NewClientSecret ??
        data?.secret ??
        data?.Secret ??
        data?.OAuthDetails?.clientSecret ??
        data?.OAuthDetails?.ClientSecret ??
        "";

      if (newSecret && typeof newSecret === "string") {
        setAppDetails((prev: any) => {
          if (!prev) return prev;
          const updated = { ...prev };
          const base = updated.Application ?? updated;
          const oauthDetails = base.OAuthDetails ?? base.oauthDetails ?? {};
          oauthDetails.clientSecret = newSecret;
          base.OAuthDetails = oauthDetails;
          if (updated.Application) updated.Application = base;
          return updated;
        });
        setEditedApp((prev: any) => {
          if (!prev) return prev;
          const updated = { ...prev };
          const base = updated.Application ?? updated;
          const oauthDetails = base.OAuthDetails ?? base.oauthDetails ?? {};
          oauthDetails.clientSecret = newSecret;
          base.OAuthDetails = oauthDetails;
          if (updated.Application) updated.Application = base;
          return updated;
        });
        setSecretModal((prev) => ({ ...prev, value: newSecret }));
      }
    } catch (e) {
      console.error("Error calling regenerateClientSecret API", e);
    }
  };

  const startEdit = () => {
    setEditedApp(appDetails);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditedApp(appDetails);
    setIsEditing(false);
  };

  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
    cancelEdit,
    startEdit,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading application details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-red-600">Error: {error}</div>
    );
  }

  return (
    <>
      <div className="flex flex-col w-full min-w-0">
        {!hideToolbar && (
        <div className="flex justify-end gap-2 mb-4">
          {isEditing ? (
            <>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
                onClick={cancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                onClick={handleSubmit}
              >
                Submit
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-sm font-medium"
              onClick={startEdit}
              aria-label="Edit Application"
              title="Edit Application"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-400 p-5 sm:p-6 space-y-6 min-h-[20rem] min-w-0 w-full">
            {appType !== "Active Directory Domain" && (
              <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                <span className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 text-blue-700">
                  <Settings2 size={15} />
                </span>
                <h2 className="text-base font-semibold text-gray-900">Application Details</h2>
              </div>
            )}
            {renderConfigurationPanel()}
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-purple-400 p-5 sm:p-6 min-w-0 w-full">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-200">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-purple-100 text-purple-700">
                <KeyRound size={15} />
              </span>
              <h2 className="text-base font-semibold text-gray-900">OAuth Details</h2>
            </div>
            {renderSection(
              "OAuth Details",
              application?.OAuthDetails ?? application?.oauthDetails,
              { sectionKind: "OAuth Details", hideTitle: true }
            )}
          </div>
        </div>
      </div>

      {secretModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{secretModal.label}</h2>
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Value:</p>
              <pre className="text-sm text-gray-900 bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-40 break-all">
                {secretModal.value || "—"}
              </pre>
            </div>
            <div className="flex justify-end gap-3">
              {secretModal.label === "Client Secret" && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  onClick={handleRegenerateSecret}
                >
                  Regenerate Secret
                </button>
              )}
              <button
                type="button"
                className="px-4 py-2 rounded-full text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={() => setSecretModal({ open: false, label: "", value: "" })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
