"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  CONNECTION_PARAMETERS_GROUP_ID,
  coerceSupportedObjectsFieldKey,
  filterIntegrationFieldsForApplicationType,
  formatIntegrationFieldLabel,
  type ApplicationTypeIntegrationFieldGroup,
} from "@/lib/api";

export type TabbedIntegrationOnboardGroupsProps = {
  applicationType: string;
  groups: ApplicationTypeIntegrationFieldGroup[];
  values: Record<string, string>;
  onChange: (fieldKey: string, value: string) => void;
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
  testConnectionLoading?: boolean;
  testConnectionFeedback?: { type: "success" | "error"; message: string } | null;
  onTestConnection?: () => void;
  canTestConnection?: boolean;
  /** When true, connection parameters render inside a collapsible card. */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Hide the intro paragraph above connection fields. */
  hideIntro?: boolean;
  /** Render only the field grid (no outer card or collapsible wrapper). */
  bare?: boolean;
};

function connectionParametersGroup(
  groups: ApplicationTypeIntegrationFieldGroup[]
): ApplicationTypeIntegrationFieldGroup | null {
  return (
    groups.find((g) => g.id === CONNECTION_PARAMETERS_GROUP_ID) ??
    groups.find((g) => g.id.toLowerCase() === "connectionparameters") ??
    null
  );
}

/** Integration step for Database and RESTService — connection parameters only. */
export default function TabbedIntegrationOnboardGroups({
  applicationType,
  groups,
  values,
  onChange,
  activeTabId: _activeTabIdProp,
  onActiveTabChange,
  testConnectionLoading = false,
  testConnectionFeedback = null,
  onTestConnection,
  canTestConnection = false,
  collapsible = false,
  defaultExpanded = true,
  hideIntro = false,
  bare = false,
}: TabbedIntegrationOnboardGroupsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeGroup = useMemo(() => connectionParametersGroup(groups), [groups]);
  const visibleFields = useMemo(
    () =>
      activeGroup
        ? filterIntegrationFieldsForApplicationType(applicationType, activeGroup.fields)
        : [],
    [activeGroup, applicationType]
  );

  useEffect(() => {
    if (activeGroup) {
      onActiveTabChange?.(activeGroup.id);
    }
  }, [activeGroup, onActiveTabChange]);

  if (!activeGroup) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
        Connection parameters are not configured for this application type.
      </p>
    );
  }

  const renderField = (fieldKey: unknown) => {
    const key = coerceSupportedObjectsFieldKey(fieldKey);
    if (!key) return null;
    const label = formatIntegrationFieldLabel(key);
    const value = values[key] ?? "";
    const isPasswordLike = /password|secret|token|passphrase/i.test(key);
    return (
      <div className="relative min-w-0" key={key}>
        <input
          type={isPasswordLike ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
          placeholder=" "
          autoComplete={isPasswordLike ? "off" : undefined}
        />
        <label
          className={`absolute left-4 transition-all duration-200 pointer-events-none ${
            value ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
          }`}
        >
          {label}
        </label>
      </div>
    );
  };

  const fieldsContent = (
    <>
      <div className="grid grid-cols-2 gap-4">
        {visibleFields.map((fk) => renderField(fk))}
      </div>

      {onTestConnection && (
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            {testConnectionFeedback ? (
              <p
                className={`text-sm ${
                  testConnectionFeedback.type === "success" ? "text-green-700" : "text-red-600"
                }`}
                role="status"
              >
                {testConnectionFeedback.message}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {applicationType === "Database"
                  ? "Use Connection URL as host:port/database (e.g. localhost:5432/keyforgedb) or a JDBC URL, then test."
                  : "Fill in all connection fields, then test before continuing."}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onTestConnection}
            disabled={testConnectionLoading || !canTestConnection}
            className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${
              testConnectionLoading || !canTestConnection
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {testConnectionLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Testing…
              </>
            ) : (
              "Test Connection"
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className={bare ? undefined : "space-y-4"}>
      {!bare && !hideIntro && (
        <div>
          <p className="text-sm text-gray-600">
            {applicationType === "RESTService Application" ||
            applicationType === "ScreenScrapping"
              ? `Configure ${applicationType} connection settings, then enter Get All Users and load schema below.`
              : `Configure ${applicationType} connection settings. Test the connection after filling in the fields below.`}
          </p>
        </div>
      )}

      {bare ? (
        fieldsContent
      ) : collapsible ? (
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`flex w-full items-center justify-between gap-3 px-5 py-4 min-h-[3.25rem] text-left bg-slate-50/90 hover:bg-slate-100/80 transition-colors ${
              expanded ? "border-b border-slate-200/80" : ""
            }`}
            aria-expanded={expanded}
          >
            <span className="text-base font-semibold text-slate-800 min-w-0">
              {activeGroup.label}
            </span>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-slate-600 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 shrink-0" aria-hidden />
            )}
          </button>
          {expanded && <div className="px-5 pb-5 pt-4 bg-white">{fieldsContent}</div>}
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-slate-800 mb-4">{activeGroup.label}</h4>
          {fieldsContent}
        </div>
      )}
    </div>
  );
}
