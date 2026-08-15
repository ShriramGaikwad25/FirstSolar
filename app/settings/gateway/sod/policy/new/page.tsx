"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { executeQuery } from "@/lib/api";

type MitigatingControl = {
  id: string;
  name: string;
};

type MitigatingControlJson = {
  "Control ID"?: string;
  Name?: string;
};

type ConditionRow = {
  id: string;
  logicalOperator?: "AND" | "OR";
  userAttribute: string;
  operand: string;
  valueType: "value" | "rule";
  value: string;
};

interface OwnerUserRow {
  userid?: string;
  userId?: string;
  username?: string;
  userName?: string;
  firstname?: string;
  firstName?: string;
  lastname?: string;
  lastName?: string;
  displayname?: string;
  displayName?: string;
}

const USER_ATTRIBUTE_OPTIONS = [
  { value: "user_department", label: "User Department" },
  { value: "user_role", label: "User Role" },
  { value: "user_access", label: "User Access / Request" },
];

type SodRuleJson = {
  Rule_ID?: string;
  Rule_Name?: string;
};

const OPERAND_OPTIONS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
];

const VALUE_TYPE_OPTIONS = [
  { value: "value", label: "Value" },
  { value: "rule", label: "Rule" },
];

const FALLBACK_MITIGATING_CONTROLS: MitigatingControl[] = [
  { id: "mc1", name: "Manager Review" },
  { id: "mc2", name: "Independent Reconciliation" },
  { id: "mc3", name: "Quarterly Audit" },
];

export default function SodPolicyNewPage() {
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerUsers, setOwnerUsers] = useState<
    Array<{ value: string; label: string; userName: string }>
  >([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const ownerDropdownRef = useRef<HTMLDivElement | null>(null);
  const [tags, setTags] = useState("");

  // Step 2 – Condition builders (using ExpressionBuilder)
  const { control, setValue, watch } = useForm<FieldValues>({
    defaultValues: {
      sodPolicyUserConditions: [],
      sodPolicyRuleConditions: [],
    },
  });

  // Step 2 – UI state for redesigned layout
  const [conditionScope, setConditionScope] = useState<"User" | "Rules">("User");
  const [ruleSearch, setRuleSearch] = useState("");
  const [selectedLeftRuleId, setSelectedLeftRuleId] = useState<string>("");
  const [selectedRightRuleId, setSelectedRightRuleId] = useState<string>("");
  const [rightRuleIds, setRightRuleIds] = useState<string[]>([]);
  const [availableRules, setAvailableRules] = useState<Array<{ id: string; name: string }>>([]);
  const [isRulesLoading, setIsRulesLoading] = useState(false);
  const [isLeftRuleDropdownOpen, setIsLeftRuleDropdownOpen] = useState(false);
  const [rightRuleSearch, setRightRuleSearch] = useState("");
  const [isRightRuleDropdownOpen, setIsRightRuleDropdownOpen] = useState(false);

  // Step 3 – Mitigating controls
  const [selectedMitigatingControlIds, setSelectedMitigatingControlIds] = useState<string[]>([]);
  const [mitigatingControls, setMitigatingControls] = useState<MitigatingControl[]>(
    FALLBACK_MITIGATING_CONTROLS
  );
  const [isMitigatingControlsLoading, setIsMitigatingControlsLoading] = useState(false);
  const [mitigatingControlDropdownOpen, setMitigatingControlDropdownOpen] = useState(false);
  const [mitigatingControlSearch, setMitigatingControlSearch] = useState("");
  const mitigatingControlDropdownRef = useRef<HTMLDivElement | null>(null);

  const canGoToStep2 =
    name.trim() &&
    description.trim() &&
    owner.trim();

  const canGoToStep3 = selectedMitigatingControlIds.length > 0;

  const canCreate = canGoToStep2 && selectedMitigatingControlIds.length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadOwnerUsers = async () => {
      try {
        setIsOwnersLoading(true);
        const payload = await executeQuery(
          "SELECT userid, username, firstname, lastname, displayname FROM usr ORDER BY username",
          []
        );

        const data: OwnerUserRow[] = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).resultSet)
            ? (payload as any).resultSet
            : Array.isArray((payload as any).rows)
              ? (payload as any).rows
              : [];
        const seen = new Set<string>();
        const options = data
          .map((u) => {
            const userName = (u.userName ?? u.username ?? "").trim();
            const userId = (u.userId ?? u.userid ?? "").trim();
            if (!userName || !userId || seen.has(userId.toLowerCase())) return null;

            seen.add(userId.toLowerCase());
            const displayName = (u.displayName ?? u.displayname ?? "").trim();
            const fullName = `${u.firstName ?? u.firstname ?? ""} ${u.lastName ?? u.lastname ?? ""}`.trim();
            const labelBase = displayName || fullName || userName;

            return {
              value: userId,
              userName,
              label: labelBase === userName ? userName : `${labelBase} (${userName})`,
            };
          })
          .filter(
            (item): item is { value: string; label: string; userName: string } =>
              item !== null
          );

        if (cancelled) return;
        setOwnerUsers(options);
      } catch {
        if (!cancelled) setOwnerUsers([]);
      } finally {
        if (!cancelled) setIsOwnersLoading(false);
      }
    };

    loadOwnerUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMitigatingControls = async () => {
      try {
        setIsMitigatingControlsLoading(true);
        const response = await fetch("/MitigatingControl.json");
        if (!response.ok) {
          throw new Error(`Failed to load MitigatingControl.json: ${response.status}`);
        }

        const json = (await response.json()) as MitigatingControlJson[];
        if (cancelled) return;

        const seen = new Set<string>();
        const mapped = json
          .map((item) => {
            const id = (item["Control ID"] ?? "").trim();
            const name = (item.Name ?? "").trim();
            if (!id || !name || seen.has(id.toLowerCase())) return null;
            seen.add(id.toLowerCase());
            return { id, name };
          })
          .filter((item): item is MitigatingControl => item !== null);

        setMitigatingControls(
          mapped.length > 0 ? mapped : FALLBACK_MITIGATING_CONTROLS
        );
      } catch (error) {
        console.error("Unable to load mitigating controls:", error);
        if (!cancelled) {
          setMitigatingControls(FALLBACK_MITIGATING_CONTROLS);
        }
      } finally {
        if (!cancelled) setIsMitigatingControlsLoading(false);
      }
    };

    loadMitigatingControls();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLeftRules = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    if (!query) return availableRules;
    return availableRules.filter((rule) =>
      `${rule.id} - ${rule.name}`.toLowerCase().includes(query)
    );
  }, [availableRules, ruleSearch]);

  const canAddConflictingRule = useMemo(() => {
    if (availableRules.length === 0) return false;
    return availableRules.some((rule) => !rightRuleIds.includes(rule.id));
  }, [availableRules, rightRuleIds]);

  const selectedMitigatingControls = useMemo(
    () => mitigatingControls.filter((mc) => selectedMitigatingControlIds.includes(mc.id)),
    [mitigatingControls, selectedMitigatingControlIds]
  );
  const selectedMitigatingControlLabel = useMemo(() => {
    if (selectedMitigatingControls.length === 0) return "";
    if (selectedMitigatingControls.length === 1) {
      const control = selectedMitigatingControls[0];
      return `${control.id} - ${control.name}`;
    }
    return `${selectedMitigatingControls.length} controls selected`;
  }, [selectedMitigatingControls]);

  const visibleMitigatingControls = useMemo(() => {
    const q = mitigatingControlSearch.trim().toLowerCase();
    if (!q) return mitigatingControls;
    return mitigatingControls.filter(
      (mc) =>
        mc.name.toLowerCase().includes(q) ||
        mc.id.toLowerCase().includes(q)
    );
  }, [mitigatingControlSearch, mitigatingControls]);

  const selectedLeftRule = useMemo(
    () => availableRules.find((rule) => rule.id === selectedLeftRuleId) ?? null,
    [availableRules, selectedLeftRuleId]
  );

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        ownerDropdownRef.current &&
        !ownerDropdownRef.current.contains(event.target as Node)
      ) {
        setOwnerDropdownOpen(false);
      }
      if (
        mitigatingControlDropdownRef.current &&
        !mitigatingControlDropdownRef.current.contains(event.target as Node)
      ) {
        setMitigatingControlDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const visibleOwnerUsers = useMemo(() => {
    const q = ownerFilter.trim().toLowerCase();
    if (!q) return ownerUsers;
    return ownerUsers.filter(
      (user) =>
        user.label.toLowerCase().includes(q) ||
        user.userName.toLowerCase().includes(q) ||
        user.value.toLowerCase().includes(q)
    );
  }, [ownerUsers, ownerFilter]);

  const selectedOwnerLabel =
    ownerUsers.find((user) => user.value === owner)?.label || owner;

  useEffect(() => {
    let cancelled = false;

    const loadRules = async () => {
      try {
        setIsRulesLoading(true);
        const response = await fetch("/SOdRules.json");
        if (!response.ok) throw new Error(`Failed to load SOdRules.json: ${response.status}`);

        const json = (await response.json()) as SodRuleJson[];
        if (cancelled) return;

        const seen = new Set<string>();
        const mapped = json
          .map((rule) => {
            const id = (rule.Rule_ID ?? "").trim();
            const name = (rule.Rule_Name ?? "").trim();
            if (!id || !name || seen.has(id.toLowerCase())) return null;
            seen.add(id.toLowerCase());
            return { id, name };
          })
          .filter((item): item is { id: string; name: string } => item !== null);

        setAvailableRules(mapped);

        if (mapped.length > 0) {
          setRightRuleIds((prev) => (prev.length > 0 ? prev : [mapped[0].id]));
          setSelectedLeftRuleId((prev) => (prev ? prev : mapped[0].id));
        }
      } catch (error) {
        console.error("Unable to load SoD rules:", error);
        if (!cancelled) setAvailableRules([]);
      } finally {
        if (!cancelled) setIsRulesLoading(false);
      }
    };

    loadRules();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed step bar below header; aligned with content area */}
      <div
        className="fixed top-[60px] z-20 bg-white border-b border-gray-200 shadow-sm px-6 py-4"
        style={{
          left: isSidebarVisible ? sidebarWidthPx : 0,
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        <div className="flex items-center gap-4 max-w-full">
          <button
            type="button"
            onClick={() =>
              setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))
            }
            disabled={currentStep === 1}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium shrink-0 ${
              currentStep === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          <div className="flex-1 flex items-center min-w-0">
            {[1, 2, 3].map((stepId, index) => (
              <React.Fragment key={stepId}>
                <div className="flex items-center shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border shrink-0 ${
                      currentStep >= stepId
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    {currentStep > stepId ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      stepId
                    )}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {stepId === 1
                      ? "Policy Details"
                      : stepId === 2
                      ? "Rules & Conditions"
                      : "Review"}
                  </span>
                </div>
                {index < 2 && (
                  <div className="flex-1 h-0.5 bg-gray-200 mx-4 min-w-[16px]" aria-hidden />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="shrink-0">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && canGoToStep2) {
                    setCurrentStep(2);
                  } else if (currentStep === 2 && canGoToStep3) {
                    setCurrentStep(3);
                  }
                }}
                disabled={
                  (currentStep === 1 && !canGoToStep2) ||
                  (currentStep === 2 && !canGoToStep3)
                }
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  (currentStep === 1 && !canGoToStep2) ||
                  (currentStep === 2 && !canGoToStep3)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canCreate}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  canCreate
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Check className="w-4 h-4 mr-2" />
                Create SoD Policy
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer so content is not hidden under fixed step bar */}
      <div className="h-[80px]" aria-hidden />

      <div className="w-full px-4 py-4">
        <div className="w-full space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Create New Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter policy name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner
                    </label>
                    <div className="relative" ref={ownerDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setOwnerDropdownOpen((prev) => !prev)}
                        className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
                      >
                        <span className={owner ? "text-gray-900 text-sm" : "text-gray-500 text-sm"}>
                          {owner
                            ? selectedOwnerLabel
                            : isOwnersLoading
                              ? "Loading users..."
                              : "Select owner"}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 transition-transform ${
                            ownerDropdownOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {ownerDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-300 rounded-md shadow-lg">
                          <div className="p-2 border-b border-gray-200">
                            <input
                              type="text"
                              value={ownerFilter}
                              onChange={(e) => setOwnerFilter(e.target.value)}
                              placeholder="Search user"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="max-h-56 overflow-auto py-1">
                            {owner &&
                              !ownerUsers.some((user) => user.value === owner) && (
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 bg-blue-50/40"
                                  onClick={() => setOwnerDropdownOpen(false)}
                                >
                                  {owner}
                                </button>
                              )}

                            {isOwnersLoading && (
                              <div className="px-3 py-2 text-sm text-gray-500">Loading users...</div>
                            )}

                            {!isOwnersLoading && visibleOwnerUsers.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
                            )}

                            {!isOwnersLoading &&
                              visibleOwnerUsers.map((user) => (
                                <button
                                  key={user.value}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                    owner === user.value ? "bg-blue-50" : ""
                                  }`}
                                  onClick={() => {
                                    setOwner(user.value);
                                    setOwnerDropdownOpen(false);
                                    setOwnerFilter("");
                                  }}
                                >
                                  {user.label}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    placeholder="Short description"
                  />
                </div>

                <div className="max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add tags"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                {/* Two partitions separated by AND */}
                <div className="flex flex-col lg:flex-row items-stretch gap-6">
                  {/* Left partition: Master Statement */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Scope dropdown */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Master Statement
                      </label>
                      <select
                        value={conditionScope}
                        onChange={(e) =>
                          setConditionScope(e.target.value as "User" | "Rules")
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="User">User</option>
                        <option value="Rules">Rules</option>
                      </select>
                    </div>

                    {/* When User selected: show expression builder */}
                    {conditionScope === "User" && (
                      <ExpressionBuilder
                        control={control as unknown as Control<FieldValues>}
                        setValue={setValue as unknown as UseFormSetValue<FieldValues>}
                        watch={watch as unknown as UseFormWatch<FieldValues>}
                        fieldName="sodPolicyUserConditions"
                        hideJsonPreview={false}
                        fullWidth
                      />
                    )}

                    {/* When Rules selected: show typeahead-like dropdown (same UX as Rules tab BP) */}
                    {conditionScope === "Rules" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Rule
                        </label>
                        <div className="relative">
                          <input
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Start typing to search and select"
                            value={ruleSearch}
                            onFocus={() => setIsLeftRuleDropdownOpen(true)}
                            onChange={(e) => {
                              setRuleSearch(e.target.value);
                              setIsLeftRuleDropdownOpen(true);
                            }}
                          />
                          {isLeftRuleDropdownOpen &&
                            filteredLeftRules.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                                <ul className="py-1 text-sm">
                                  {filteredLeftRules.map((rule) => (
                                    <li key={rule.id}>
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 text-left hover:bg-blue-50"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setRuleSearch(`${rule.id} - ${rule.name}`);
                                          setSelectedLeftRuleId(rule.id);
                                          setIsLeftRuleDropdownOpen(false);
                                        }}
                                      >
                                        {rule.id} - {rule.name}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          {isRulesLoading && (
                            <p className="mt-1 text-xs text-gray-500">Loading rules...</p>
                          )}
                          {!isRulesLoading && availableRules.length === 0 && (
                            <p className="mt-1 text-xs text-gray-500">No rules available.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AND separator */}
                  <div className="flex items-center justify-center">
                    <span className="px-3 py-2 rounded-full bg-gray-100 border border-gray-300 text-xs font-semibold text-gray-700">
                      AND
                    </span>
                  </div>

                  {/* Right partition: Conflicting Statement (Rules with OR) */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <label className="text-sm font-medium text-gray-700">
                      CONFLICTING STATEMENT
                    </label>

                    <div className="mt-1 space-y-2">
                      {rightRuleIds.map((id, index) => {
                          const rule = availableRules.find((r) => r.id === id) ?? availableRules[0];
                          const selectedInOtherRows = new Set(
                            rightRuleIds.filter((ruleId, i) => i !== index)
                          );
                          const selectableRules = availableRules.filter(
                            (opt) => !selectedInOtherRows.has(opt.id) || opt.id === id
                          );
                          return (
                            <React.Fragment key={`${id}-${index}`}>
                              {index > 0 && (
                                <div className="flex justify-center my-1">
                                  <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-300 text-[11px] font-semibold text-gray-600">
                                    OR
                                  </span>
                                </div>
                              )}
                              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                                <select
                                  value={rule?.id ?? ""}
                                  onChange={(e) => {
                                    const newId = e.target.value;
                                    if (
                                      rightRuleIds.some(
                                        (ruleId, i) => i !== index && ruleId === newId
                                      )
                                    ) {
                                      return;
                                    }
                                    setRightRuleIds((prev) =>
                                      prev.map((ruleId, i) => (i === index ? newId : ruleId))
                                    );
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {id && !availableRules.some((opt) => opt.id === id) && (
                                    <option value={id}>{id} - (selected rule)</option>
                                  )}
                                  {selectableRules.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.id} - {opt.name}
                                    </option>
                                  ))}
                                </select>
                                {/* Remove button for this line (not shown on first row) */}
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRightRuleIds((prev) =>
                                        prev.filter((_, i) => i !== index)
                                      )
                                    }
                                    className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold w-8 h-8"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    {/* Add button below the dropdowns, like in ExpressionBuilder */}
                    <div className="flex justify-start mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRightRuleIds((prev) => {
                            const nextRule = availableRules.find(
                              (rule) => !prev.includes(rule.id)
                            );
                            if (!nextRule) return prev;
                            return [...prev, nextRule.id];
                          });
                        }}
                        disabled={!canAddConflictingRule}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 hover:bg-blue-700"
                      >
                        <span className="text-sm leading-none">+</span>
                        <span>Add Rule</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mitigating control moved into Step 2 */}
                <div className="pt-2">
                  <div className="w-full lg:w-[calc(50%-12px)]">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mitigating Control
                    </label>
                    <div className="space-y-2" ref={mitigatingControlDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setMitigatingControlDropdownOpen((prev) => !prev)}
                        className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
                      >
                        <span
                          className={
                            selectedMitigatingControls.length > 0
                              ? "text-gray-900 text-sm"
                              : "text-gray-500 text-sm"
                          }
                        >
                          {selectedMitigatingControls.length > 0
                            ? selectedMitigatingControlLabel
                            : isMitigatingControlsLoading
                              ? "Loading mitigating controls..."
                              : "Select mitigating control"}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 transition-transform ${
                            mitigatingControlDropdownOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {mitigatingControlDropdownOpen && (
                        <div className="w-full bg-white border border-gray-300 rounded-md shadow-sm">
                          <div className="p-2 border-b border-gray-200">
                            <input
                              type="text"
                              value={mitigatingControlSearch}
                              onChange={(e) => setMitigatingControlSearch(e.target.value)}
                              placeholder="Search mitigating control"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="max-h-[210px] overflow-auto py-1">
                            {isMitigatingControlsLoading && (
                              <div className="px-3 py-2 text-sm text-gray-500">Loading mitigating controls...</div>
                            )}

                            {!isMitigatingControlsLoading && visibleMitigatingControls.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">No mitigating controls found</div>
                            )}

                            {!isMitigatingControlsLoading &&
                              visibleMitigatingControls.map((mc) => (
                                <button
                                  key={mc.id}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                    selectedMitigatingControlIds.includes(mc.id) ? "bg-blue-50" : ""
                                  }`}
                                  onClick={() => {
                                    setSelectedMitigatingControlIds((prev) =>
                                      prev.includes(mc.id)
                                        ? prev.filter((id) => id !== mc.id)
                                        : [...prev, mc.id]
                                    );
                                  }}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                                        selectedMitigatingControlIds.includes(mc.id)
                                          ? "border-blue-600 bg-blue-600 text-white"
                                          : "border-gray-300 bg-white text-transparent"
                                      }`}
                                    >
                                      <Check className="h-3 w-3" />
                                    </span>
                                    <span>{mc.id} - {mc.name}</span>
                                  </span>
                                </button>
                              ))}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-md">
                            <span className="text-xs text-gray-600">
                              {selectedMitigatingControlIds.length} selected
                            </span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-700 hover:text-blue-800"
                              onClick={() => {
                                setMitigatingControlDropdownOpen(false);
                                setMitigatingControlSearch("");
                              }}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Step 3 – Review
                </h2>
                <p className="text-xs text-gray-600">
                  Confirm all policy details before creating the SoD policy.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Name</p>
                    <p className="mt-1 text-gray-900">{name || "N/A"}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Owner</p>
                    <p className="mt-1 text-gray-900">{selectedOwnerLabel || "N/A"}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50 md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Description</p>
                    <p className="mt-1 text-gray-900">{description || "N/A"}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50 md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Tags</p>
                    <p className="mt-1 text-gray-900">{tags || "N/A"}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Master Statement</p>
                    <p className="mt-1 text-gray-900">
                      {conditionScope === "User"
                        ? "User conditions configured"
                        : selectedLeftRule
                          ? `${selectedLeftRule.id} - ${selectedLeftRule.name}`
                          : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Conflicting Statement</p>
                    <p className="mt-1 text-gray-900">
                      {rightRuleIds.length > 0
                        ? rightRuleIds
                            .map((id) => {
                              const match = availableRules.find((r) => r.id === id);
                              return match ? `${match.id} - ${match.name}` : id;
                            })
                            .join(" OR ")
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50 md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Mitigating Controls</p>
                    <p className="mt-1 text-gray-900">
                      {selectedMitigatingControls.length > 0
                        ? selectedMitigatingControls
                            .map((mc) => `${mc.id} - ${mc.name}`)
                            .join(", ")
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

