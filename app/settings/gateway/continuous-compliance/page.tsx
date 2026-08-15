"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import AsyncSelect from "react-select/async";
import { customOption, loadIspmApps } from "@/components/MsAsyncData";

type AppOption = {
  value: string;
  label: string;
  image?: string;
};

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${checked ? "bg-blue-600" : "bg-gray-300"}`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 shrink-0 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function LineItem({
  label,
  checked,
  onToggle,
  expiryDays,
  onExpiryChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  expiryDays: string;
  onExpiryChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-2 border-b border-gray-200 last:border-0">
      <span className="text-sm text-gray-700 min-w-0">{label}</span>
      {checked ? (
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs text-gray-600 whitespace-nowrap">Expiry Duration</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={expiryDays}
              disabled={disabled}
              onChange={(e) => onExpiryChange(e.target.value)}
              className="w-16 shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
            />
            <span className="text-xs text-gray-500">days</span>
          </div>
        </div>
      ) : (
        <span className="w-24 text-xs text-gray-400">—</span>
      )}
      <div className="flex justify-end">
        <Toggle checked={checked} onChange={onToggle} label="" disabled={disabled} />
      </div>
    </div>
  );
}

export default function ContinuousComplianceSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [expandedCards, setExpandedCards] = useState<boolean[]>([false, false, false]);

  // User Lifecycle (each line: toggle + expiry duration)
  const [lifecycleRole, setLifecycleRole] = useState(false);
  const [lifecycleRoleExpiry, setLifecycleRoleExpiry] = useState("60");
  const [lifecycleJobTitle, setLifecycleJobTitle] = useState(false);
  const [lifecycleJobTitleExpiry, setLifecycleJobTitleExpiry] = useState("60");
  const [lifecycleDepartment, setLifecycleDepartment] = useState(false);
  const [lifecycleDepartmentExpiry, setLifecycleDepartmentExpiry] = useState("60");
  const [lifecycleManager, setLifecycleManager] = useState(false);
  const [lifecycleManagerExpiry, setLifecycleManagerExpiry] = useState("60");

  // Application Governance
  const [govNDE, setGovNDE] = useState(false);
  const [govNDEExpiry, setGovNDEExpiry] = useState("60");
  const [govPrivilegedAccess, setGovPrivilegedAccess] = useState(false);
  const [govPrivilegedAccessExpiry, setGovPrivilegedAccessExpiry] = useState("60");
  const [govAccountCreation, setGovAccountCreation] = useState(false);
  const [govAccountCreationExpiry, setGovAccountCreationExpiry] = useState("60");
  const [govAppsMode, setGovAppsMode] = useState<"all" | "specific">("all");
  const [govSpecificApps, setGovSpecificApps] = useState<AppOption[]>([]);
  const [govInactiveAccounts, setGovInactiveAccounts] = useState(false);
  const [govInactiveAccountsExpiry1, setGovInactiveAccountsExpiry1] = useState("60");
  const [govInactiveAccountsExpiry2, setGovInactiveAccountsExpiry2] = useState("90");
  const [govConditionalExpiry, setGovConditionalExpiry] = useState(false);
  const [govConditionalExpiryDuration1, setGovConditionalExpiryDuration1] = useState("5");
  const [govConditionalExpiryDuration2, setGovConditionalExpiryDuration2] = useState("10");

  // SoD - Conflict detection
  const [sodConflictDetection, setSodConflictDetection] = useState(false);
  const [sodConflictExpiryDays, setSodConflictExpiryDays] = useState("60");
  const [sodConflictAppsMode, setSodConflictAppsMode] = useState<"all" | "specific">("all");
  const [sodConflictSelectedApps, setSodConflictSelectedApps] = useState<AppOption[]>([]);

  // SoD - Conditional Access Expiry
  const [sodCondAccessExpiry, setSodCondAccessExpiry] = useState(false);
  const [sodCondAccessDaysBefore, setSodCondAccessDaysBefore] = useState("7");
  const [sodCondAccessExpiryDuration, setSodCondAccessExpiryDuration] = useState("60");
  const [sodCondAppsMode, setSodCondAppsMode] = useState<"all" | "specific">("all");
  const [sodCondSelectedApps, setSodCondSelectedApps] = useState<AppOption[]>([]);

  const cards = [
    { title: "User Lifecycle", key: "user-lifecycle" },
    { title: "Application Governance", key: "application-governance" },
    { title: "SoD", key: "sod" },
  ];

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const handleSave = () => {
    // TODO: Persist settings when save endpoint is available.
    setIsEditing(false);
  };

  const formDisabled = !isEditing;

  return (
    <div className="h-full p-6">
      <div className="w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Continuous Compliance Settings</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isEditing}
            >
              Save
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {cards.map((card, idx) => (
            <div
              key={card.key}
              className="border border-gray-200 rounded-xl shadow-sm overflow-hidden bg-white"
            >
              <button
                className="w-full flex items-center justify-between px-4 py-4 bg-white font-semibold text-sm hover:bg-gray-50 transition-colors group"
                onClick={() => toggleCard(idx)}
                aria-expanded={expandedCards[idx] ? "true" : "false"}
              >
                <span className="flex-1 text-left mr-3 text-gray-900">{card.title}</span>
                <div className="flex-shrink-0">
                  {expandedCards[idx] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                  )}
                </div>
              </button>

              {expandedCards[idx] && (
                <div className="p-4 text-sm space-y-6 bg-gray-50 border-t border-gray-100">
                  {/* User Lifecycle */}
                  {card.key === "user-lifecycle" && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-800 mb-2">User Lifecycle Change Options</h4>
                      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 border-b border-gray-200">
                          <span>Option</span>
                          <span aria-hidden className="select-none" />
                          <span>Enable / Disable</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                          <LineItem
                            label="Role"
                            checked={lifecycleRole}
                            onToggle={setLifecycleRole}
                            expiryDays={lifecycleRoleExpiry}
                            onExpiryChange={setLifecycleRoleExpiry}
                            disabled={formDisabled}
                          />
                          <LineItem
                            label="Job Title"
                            checked={lifecycleJobTitle}
                            onToggle={setLifecycleJobTitle}
                            expiryDays={lifecycleJobTitleExpiry}
                            onExpiryChange={setLifecycleJobTitleExpiry}
                            disabled={formDisabled}
                          />
                          <LineItem
                            label="Department"
                            checked={lifecycleDepartment}
                            onToggle={setLifecycleDepartment}
                            expiryDays={lifecycleDepartmentExpiry}
                            onExpiryChange={setLifecycleDepartmentExpiry}
                            disabled={formDisabled}
                          />
                          <LineItem
                            label="Manager"
                            checked={lifecycleManager}
                            onToggle={setLifecycleManager}
                            expiryDays={lifecycleManagerExpiry}
                            onExpiryChange={setLifecycleManagerExpiry}
                            disabled={formDisabled}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Application Governance */}
                  {card.key === "application-governance" && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-800 mb-2">Application Governance Options</h4>
                      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">Applications Scope</span>
                            <button
                              type="button"
                              disabled={formDisabled}
                              className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                govAppsMode === "all"
                                  ? "bg-[#15274E] text-white border-[#15274E]"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                              }`}
                              onClick={() => setGovAppsMode("all")}
                            >
                              Select All Apps
                            </button>
                            <button
                              type="button"
                              disabled={formDisabled}
                              className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                govAppsMode === "specific"
                                  ? "bg-[#15274E] text-white border-[#15274E]"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                              }`}
                              onClick={() => setGovAppsMode("specific")}
                            >
                              Select Specific Apps
                            </button>
                          </div>
                          {govAppsMode === "specific" && (
                            <div className="mt-3 max-w-xl">
                              <AsyncSelect
                                isMulti
                                cacheOptions
                                defaultOptions
                                isSearchable
                                isDisabled={formDisabled}
                                loadOptions={loadIspmApps}
                                placeholder="Select Specific App(s)"
                                components={{ Option: customOption as any }}
                                value={govSpecificApps}
                                onChange={(newValue) => setGovSpecificApps((newValue as AppOption[]) || [])}
                                hideSelectedOptions={false}
                                closeMenuOnSelect={false}
                                menuPlacement="auto"
                              />
                            </div>
                          )}
                        </div>
                        <div className="divide-y divide-gray-200">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 border-b border-gray-200">
                            <span>Option</span>
                            <span aria-hidden className="select-none" />
                            <span>Enable / Disable</span>
                          </div>
                          <LineItem
                            label="NDE"
                            checked={govNDE}
                            onToggle={setGovNDE}
                            expiryDays={govNDEExpiry}
                            onExpiryChange={setGovNDEExpiry}
                            disabled={formDisabled}
                          />
                          <LineItem
                            label="Privileged Access"
                            checked={govPrivilegedAccess}
                            onToggle={setGovPrivilegedAccess}
                            expiryDays={govPrivilegedAccessExpiry}
                            onExpiryChange={setGovPrivilegedAccessExpiry}
                            disabled={formDisabled}
                          />
                          <LineItem
                            label="Account Creation"
                            checked={govAccountCreation}
                            onToggle={setGovAccountCreation}
                            expiryDays={govAccountCreationExpiry}
                            onExpiryChange={setGovAccountCreationExpiry}
                            disabled={formDisabled}
                          />
                          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2">
                            <span className="text-sm text-gray-700">Inactive accounts</span>
                            {govInactiveAccounts ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={govInactiveAccountsExpiry1}
                                    onChange={(e) => setGovInactiveAccountsExpiry1(e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={govInactiveAccountsExpiry2}
                                    onChange={(e) => setGovInactiveAccountsExpiry2(e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="w-24 text-xs text-gray-400">—</span>
                                <span className="w-24 text-xs text-gray-400">—</span>
                              </>
                            )}
                            <Toggle checked={govInactiveAccounts} onChange={setGovInactiveAccounts} label="" disabled={formDisabled} />
                          </div>
                          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2">
                            <span className="text-sm text-gray-700">Conditional access expiry</span>
                            {govConditionalExpiry ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={govConditionalExpiryDuration1}
                                    onChange={(e) => setGovConditionalExpiryDuration1(e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={govConditionalExpiryDuration2}
                                    onChange={(e) => setGovConditionalExpiryDuration2(e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="w-24 text-xs text-gray-400">—</span>
                                <span className="w-24 text-xs text-gray-400">—</span>
                              </>
                            )}
                            <Toggle checked={govConditionalExpiry} onChange={setGovConditionalExpiry} label="" disabled={formDisabled} />
                          </div>
                        </div> 
                      </div>
                    </div>
                  )}

                  {/* SoD */}
                  {card.key === "sod" && (
                    <>
                      {/* SoD Conflict detection */}
                      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-3">
                        <div className="grid grid-cols-[1.2fr_minmax(0,2.2fr)_auto_auto] items-center gap-4">
                          <span className="text-sm font-medium text-gray-800">SoD Conflict detection</span>
                          <div className="space-y-1">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs text-gray-600">Applications:</span>
                                <label className={`flex items-center gap-1 text-xs ${formDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                                  <input
                                    type="radio"
                                    name="sod-conflict-apps"
                                    disabled={formDisabled}
                                    checked={sodConflictAppsMode === "all"}
                                    onChange={() => setSodConflictAppsMode("all")}
                                    className="text-blue-600"
                                  />
                                  <span>All</span>
                                </label>
                                <label className={`flex items-center gap-1 text-xs ${formDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                                  <input
                                    type="radio"
                                    name="sod-conflict-apps"
                                    disabled={formDisabled}
                                    checked={sodConflictAppsMode === "specific"}
                                    onChange={() => setSodConflictAppsMode("specific")}
                                    className="text-blue-600"
                                  />
                                  <span>Select Apps</span>
                                </label>
                              </div>
                              {sodConflictAppsMode === "specific" && (
                                <div className="w-full max-w-xl">
                                  <AsyncSelect
                                    isMulti
                                    cacheOptions
                                    defaultOptions
                                    isSearchable
                                    isDisabled={formDisabled}
                                    loadOptions={loadIspmApps}
                                    placeholder="Select Specific App(s)"
                                    components={{ Option: customOption as any }}
                                    value={sodConflictSelectedApps}
                                    onChange={(newValue) => setSodConflictSelectedApps((newValue as AppOption[]) || [])}
                                    hideSelectedOptions={false}
                                    closeMenuOnSelect={false}
                                    menuPlacement="auto"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                            {sodConflictDetection ? (
                              <>
                                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Expiry Duration</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={sodConflictExpiryDays}
                                    onChange={(e) => setSodConflictExpiryDays(e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <Toggle
                              label="Enable SoD conflict detection"
                              checked={sodConflictDetection}
                              onChange={setSodConflictDetection}
                              disabled={formDisabled}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Conditional Access Expiry */}
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="grid grid-cols-[1.2fr_minmax(0,2.2fr)_auto_auto] items-center gap-4">
                          <span className="text-sm font-medium text-gray-800">Conditional Access Expiry</span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-gray-600">Expiry window</span>
                              {sodCondAccessExpiry ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={sodCondAccessDaysBefore}
                                    onChange={(e) => setSodCondAccessDaysBefore(e.target.value)}
                                    className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days before expiry</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Duration before expiry</span>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs text-gray-600">Applications:</span>
                                <label className={`flex items-center gap-1 text-xs ${formDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                                  <input
                                    type="radio"
                                    name="sod-cond-apps"
                                    disabled={formDisabled}
                                    checked={sodCondAppsMode === "all"}
                                    onChange={() => setSodCondAppsMode("all")}
                                    className="text-blue-600"
                                  />
                                  <span>All</span>
                                </label>
                                <label className={`flex items-center gap-1 text-xs ${formDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                                  <input
                                    type="radio"
                                    name="sod-cond-apps"
                                    disabled={formDisabled}
                                    checked={sodCondAppsMode === "specific"}
                                    onChange={() => setSodCondAppsMode("specific")}
                                    className="text-blue-600"
                                  />
                                  <span>Select Apps</span>
                                </label>
                              </div>
                              {sodCondAppsMode === "specific" && (
                                <div className="w-full max-w-xl">
                                  <AsyncSelect
                                    isMulti
                                    cacheOptions
                                    defaultOptions
                                    isSearchable
                                    isDisabled={formDisabled}
                                    loadOptions={loadIspmApps}
                                    placeholder="Select Specific App(s)"
                                    components={{ Option: customOption as any }}
                                    value={sodCondSelectedApps}
                                    onChange={(newValue) => setSodCondSelectedApps((newValue as AppOption[]) || [])}
                                    hideSelectedOptions={false}
                                    closeMenuOnSelect={false}
                                    menuPlacement="auto"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                            {sodCondAccessExpiry ? (
                              <>
                                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Expiry Duration</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={formDisabled}
                                    value={sodCondAccessExpiryDuration}
                                    onChange={(e) => setSodCondAccessExpiryDuration(e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70"
                                  />
                                  <span className="text-xs text-gray-500">days</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <Toggle
                              label="Enable Conditional Access Expiry"
                              checked={sodCondAccessExpiry}
                              onChange={setSodCondAccessExpiry}
                              disabled={formDisabled}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
