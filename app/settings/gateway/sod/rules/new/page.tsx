"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import SelectAccessTab from "@/app/access-request/SelectAccessTab";
import { Check, ChevronDown, ChevronLeft, ChevronRight, FileText, FolderTree, ShieldCheck, UserRound } from "lucide-react";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import { useCart } from "@/contexts/CartContext";
import { executeQuery } from "@/lib/api";
import { useSearchParams } from "next/navigation";

type BusinessProcess = {
  id: string;
  name: string;
};

type CatalogItem = {
  id: string;
  name: string;
  description: string;
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

const BUSINESS_PROCESSES: BusinessProcess[] = [
  { id: "BP1", name: "Procure to Pay" },
  { id: "BP2", name: "Revenue and Credit Management" },
  { id: "BP3", name: "Directory Access Administration" },
  { id: "BP4", name: "Identity Governance and Access App" },
  { id: "BP5", name: "HR Lifecycle Management" },
  { id: "BP6", name: "HCM Platform Operations" },
];

const CATALOG_ITEMS: CatalogItem[] = [
  { id: "c1", name: "SAP_AP_PAYMENTS", description: "Process outgoing payments" },
  { id: "c2", name: "SAP_VENDOR_CREATE", description: "Create and maintain vendors" },
  { id: "c3", name: "SAP_JE_POST", description: "Post journal entries" },
  { id: "c4", name: "SAP_JE_APPROVE", description: "Approve journal entries" },
];
const SOD_RULE_EDIT_STORAGE_KEY = "sodRuleEditDraft";

export default function SodRulesNewPage() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const { items: cartItems } = useCart();

  // Step 1 state
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
  const [bpSearch, setBpSearch] = useState("");
  const [availableBps, setAvailableBps] = useState<BusinessProcess[]>(BUSINESS_PROCESSES);
  const [selectedBps, setSelectedBps] = useState<BusinessProcess[]>([]);
  const [isBpDropdownOpen, setIsBpDropdownOpen] = useState(false);
  const bpDropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredAvailableBps = useMemo(
    () =>
      !bpSearch.trim()
        ? availableBps
        : availableBps.filter((bp) =>
            `${bp.id} - ${bp.name}`.toLowerCase().includes(bpSearch.trim().toLowerCase())
          ),
    [availableBps, bpSearch]
  );

  const canGoToStep2 =
    name.trim() !== "" &&
    description.trim() !== "" &&
    owner.trim() !== "" &&
    selectedBps.length > 0;

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
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        ownerDropdownRef.current &&
        !ownerDropdownRef.current.contains(event.target as Node)
      ) {
        setOwnerDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        bpDropdownRef.current &&
        !bpDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBpDropdownOpen(false);
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
    if (!isEditMode) return;

    try {
      const stored = localStorage.getItem(SOD_RULE_EDIT_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as {
        name?: string;
        description?: string;
        owner?: string;
        tags?: string;
        businessProcess?: string;
      };

      setName(parsed.name ?? "");
      setDescription(parsed.description ?? "");
      setOwner(parsed.owner ?? "");
      setTags(parsed.tags ?? "");

      const bpRaw = (parsed.businessProcess ?? "").trim();
      if (bpRaw) {
        const matchedBp =
          availableBps.find(
            (bp) =>
              `${bp.id} - ${bp.name}`.toLowerCase() === bpRaw.toLowerCase() ||
              bp.name.toLowerCase() === bpRaw.toLowerCase() ||
              bp.id.toLowerCase() === bpRaw.toLowerCase()
          ) ?? null;

        if (matchedBp) {
          setSelectedBps([matchedBp]);
          setBpSearch(`${matchedBp.id} - ${matchedBp.name}`);
        } else {
          setSelectedBps([]);
          setBpSearch(bpRaw);
        }
      }
    } catch (error) {
      console.error("Unable to load rule edit draft:", error);
    }
  }, [availableBps, isEditMode]);

  useEffect(() => {
    if (!owner || ownerUsers.length === 0) return;
    if (ownerUsers.some((user) => user.value === owner)) return;

    const normalizedOwner = owner.toLowerCase();
    const matchedUser = ownerUsers.find(
      (user) =>
        user.label.toLowerCase() === normalizedOwner ||
        user.userName.toLowerCase() === normalizedOwner
    );
    if (matchedUser) {
      setOwner(matchedUser.value);
    }
  }, [owner, ownerUsers]);

  // Step 2 state - catalog API wiring (mirrors Access Request flow)
  const [catalogData, setCatalogData] = useState<any[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedAppInstanceId, setSelectedAppInstanceId] = useState<string | null>(null);
  const [showApplicationInstancesOnly, setShowApplicationInstancesOnly] = useState(false);
  const [applicationInstances, setApplicationInstances] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<string>("All");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogFetchKeyRef = useRef<string | null>(null);
  const catalogPageRef = useRef(catalogPage);

  const apiRoles = useMemo(() => {
    if (!catalogData || catalogData.length === 0) return [];

    const firstRow = catalogData[0] || {};
    const keys = Object.keys(firstRow);

    const findKey = (predicates: ((k: string) => boolean)[]): string | undefined => {
      const lowerKeys = keys.map((k) => k.toLowerCase());
      for (const predicate of predicates) {
        const idx = lowerKeys.findIndex(predicate);
        if (idx !== -1) return keys[idx];
      }
      return undefined;
    };

    const nameKey =
      findKey([
        (k) => k === "name",
        (k) => k === "entitlementname",
        (k) => k === "entitlement_name",
        (k) => k === "applicationname",
      ]) || keys[0];

    const riskKey =
      findKey([
        (k) => k === "risk",
        (k) => k.endsWith("_risk"),
        (k) => k.includes("risk"),
      ]) || keys[1] || keys[0];

    const descriptionKey =
      findKey([
        (k) => k === "description",
        (k) => k === "entitlementdescription",
        (k) => k === "entitlement_description",
        (k) => k === "business_objective",
      ]) || keys[2] || keys[0];

    const idKeysPreference = ["catalogid", "entitlementid", "appinstanceid", "id"];

    const resolveIdKey = (): string | undefined => {
      const lowerKeys = keys.map((k) => k.toLowerCase());
      for (const pref of idKeysPreference) {
        const idx = lowerKeys.indexOf(pref);
        if (idx !== -1) return keys[idx];
      }
      return undefined;
    };

    const idKey = resolveIdKey();

    const normalizeRisk = (value: string): "Low" | "Medium" | "High" => {
      const v = value.toLowerCase();
      if (v.startsWith("high")) return "High";
      if (v.startsWith("medium")) return "Medium";
      if (v.startsWith("low")) return "Low";
      return "Low";
    };

    return catalogData.map((row, idx) => {
      const rawName =
        row[nameKey] !== undefined && row[nameKey] !== null ? String(row[nameKey]) : "";
      const rawRisk =
        row[riskKey] !== undefined && row[riskKey] !== null ? String(row[riskKey]) : "";
      const rawDesc =
        row[descriptionKey] !== undefined && row[descriptionKey] !== null
          ? String(row[descriptionKey])
          : "";
      const rawType =
        typeof row.type === "string"
          ? row.type
          : typeof row.Type === "string"
          ? row.Type
          : undefined;

      const idValue =
        (idKey && row[idKey]) ||
        row.catalogid ||
        row.entitlementid ||
        row.appinstanceid ||
        idx;

      return {
        id: String(idValue).trim(),
        name: rawName || "Unnamed access",
        risk: normalizeRisk(rawRisk),
        description: rawDesc,
        type: rawType,
        catalogRow: row,
      };
    });
  }, [catalogData]);

  const getRoleByCartItemId = (itemId: string) => {
    const normalizedId = itemId.trim().toLowerCase();
    return apiRoles.find((role) => role.id.trim().toLowerCase() === normalizedId);
  };

  const getApplicationNameFromRole = (role: any): string => {
    const row = role?.catalogRow;
    if (!row || typeof row !== "object") return "";
    const value =
      (row.applicationname as string | undefined) ??
      (row.applicationName as string | undefined) ??
      (row.application_name as string | undefined) ??
      (row.appname as string | undefined) ??
      (row.appName as string | undefined) ??
      "";
    return typeof value === "string" ? value.trim() : "";
  };

  const hasTrainingCheck = (role: any): boolean => {
    const raw = role?.catalogRow?.training_code as unknown;
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return false;
    const first = arr[0] as Record<string, unknown>;
    const code = String(first?.code ?? "").trim();
    return code.length > 0;
  };

  // Keep ref in sync so we can ignore stale responses
  catalogPageRef.current = catalogPage;

  // Fetch Application Instances list for dropdown when on step 2
  useEffect(() => {
    if (currentStep !== 2) return;
    const url = "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "SELECT appinstanceid, name FROM vw_catalog WHERE type = 'ApplicationInstance' ORDER BY name",
        parameters: [],
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((data) => {
        let rows: any[] = [];
        if (Array.isArray(data)) rows = data;
        else if (Array.isArray((data as any).resultSet)) rows = (data as any).resultSet;
        else if (Array.isArray((data as any).rows)) rows = (data as any).rows;
        const seen = new Set<string>();
        const list: Array<{ id: string; name: string }> = [];
        rows.forEach((r: any) => {
          const id = (r.appinstanceid ?? r.appInstanceId ?? r.app_instance_id ?? "")
            .toString()
            .trim();
          const name = (r.name ?? "").toString().trim();
          if (id && !seen.has(id)) {
            seen.add(id);
            list.push({ id, name: name || id });
          }
        });
        setApplicationInstances(list);
      })
      .catch(() => setApplicationInstances([]));
  }, [currentStep]);

  // Load catalog in Step 2
  useEffect(() => {
    if (currentStep !== 2) return;

    const fetchKey = `2-${catalogPage}-${selectedAppInstanceId ?? "all"}-${showApplicationInstancesOnly}-${catalogTypeFilter}-${tagFilter || "all"}`;
    if (catalogFetchKeyRef.current === fetchKey) return;
    catalogFetchKeyRef.current = fetchKey;

    const pageRequested = catalogPage;
    setCatalogLoading(true);
    setCatalogError(null);

    const limit = 100;
    const offset = (catalogPage - 1) * limit;

    const isFilteredByAppInstance =
      !!selectedAppInstanceId?.trim() && !showApplicationInstancesOnly;
    const trimmedTag = tagFilter.trim();

    const body =
      showApplicationInstancesOnly
        ? {
            query:
              "SELECT * FROM vw_catalog WHERE type = 'ApplicationInstance' ORDER BY appinstanceid LIMIT ? OFFSET ?",
            parameters: [limit, offset],
          }
        : catalogTypeFilter === "Tags"
        ? {
            query:
              trimmedTag
                ? `SELECT * FROM vw_catalog WHERE type = 'Entitlement' AND tags ILIKE '%${trimmedTag}%' ORDER BY appinstanceid LIMIT ? OFFSET ?`
                : "SELECT * FROM vw_catalog WHERE type = 'Entitlement' ORDER BY appinstanceid LIMIT ? OFFSET ?",
            parameters: [limit, offset],
          }
        : isFilteredByAppInstance
        ? {
            query:
              "SELECT * FROM vw_catalog WHERE type = 'Entitlement' AND appinstanceid = ?::uuid ORDER BY appinstanceid LIMIT ? OFFSET ?",
            parameters: [selectedAppInstanceId!.trim(), limit, offset],
          }
        : {
            query: "SELECT * FROM vw_catalog ORDER BY appinstanceid LIMIT ? OFFSET ?",
            parameters: [limit, offset],
          };

    fetch("https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (catalogPageRef.current !== pageRequested) return;
        let rows: any[] = [];
        if (Array.isArray(data)) rows = data;
        else if (Array.isArray((data as any).resultSet)) rows = (data as any).resultSet;
        else if (Array.isArray((data as any).rows)) rows = (data as any).rows;
        setCatalogData(rows);
      })
      .catch((err) => {
        if (catalogPageRef.current !== pageRequested) return;
        console.error("Catalog fetch failed:", err);
        setCatalogError(err instanceof Error ? err.message : "Failed to load catalog");
      })
      .finally(() => {
        if (catalogPageRef.current === pageRequested) setCatalogLoading(false);
        catalogFetchKeyRef.current = null;
      });
  }, [
    currentStep,
    catalogPage,
    selectedAppInstanceId,
    showApplicationInstancesOnly,
    catalogTypeFilter,
    tagFilter,
  ]);

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
                    {currentStep === 3 || currentStep > stepId ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      stepId
                    )}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {stepId === 1
                      ? "Rule Details"
                      : stepId === 2
                        ? "Add Access"
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
                  if (currentStep === 1) {
                    if (canGoToStep2) setCurrentStep(2);
                  } else if (currentStep === 2) {
                    setCurrentStep(3);
                  }
                }}
                disabled={currentStep === 1 && !canGoToStep2}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  currentStep === 1 && !canGoToStep2
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
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                <Check className="w-4 h-4 mr-2" />
                {isEditMode ? "Update Rule" : "Create Rule"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer so content is not hidden under fixed step bar */}
      <div className="h-[80px]" aria-hidden />

      <div className="w-full">
        <div className="w-full space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Name & Owner in first row */}
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
                      placeholder="Enter rule name"
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

                {/* Tags & Business Process in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Process
                    </label>
                    <div className="relative" ref={bpDropdownRef}>
                      <input
                        className="w-full h-[42px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Start typing to search and select"
                        value={bpSearch}
                        onFocus={() => setIsBpDropdownOpen(true)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setBpSearch(value);
                          setIsBpDropdownOpen(true);
                          const found = availableBps.find(
                            (bp) => `${bp.id} - ${bp.name}`.toLowerCase() === value.toLowerCase()
                          );
                          setSelectedBps(found ? [found] : []);
                        }}
                      />
                      {isBpDropdownOpen && filteredAvailableBps.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                          <ul className="py-1 text-sm">
                            {filteredAvailableBps.map((bp) => (
                              <li key={bp.id}>
                                <button
                                  type="button"
                                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setBpSearch(`${bp.id} - ${bp.name}`);
                                    setSelectedBps([bp]);
                                    setIsBpDropdownOpen(false);
                                  }}
                                >
                                  {bp.id} - {bp.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <SelectAccessTab
                  hideRecommendedTab
                  hideAddDetailsSidebar
                  rolesFromApi={apiRoles}
                  apiCurrentPage={catalogPage}
                  onApiPageChange={(page) => setCatalogPage(page)}
                  applicationInstances={applicationInstances}
                  selectedAppInstanceId={selectedAppInstanceId}
                  onAppInstanceChange={(id) => {
                    setSelectedAppInstanceId(id || null);
                    setCatalogPage(1);
                  }}
                  showApplicationInstancesOnly={showApplicationInstancesOnly}
                  onShowApplicationInstancesOnlyChange={(checked) => {
                    setShowApplicationInstancesOnly(checked);
                    setCatalogPage(1);
                  }}
                  onCatalogTypeChange={(value) => {
                    setCatalogTypeFilter(value);
                    setCatalogPage(1);
                  }}
                  onTagSearch={(tag) => {
                    setTagFilter(tag);
                    setCatalogPage(1);
                  }}
                />
                {catalogError && (
                  <p className="text-xs text-red-600">{catalogError}</p>
                )}
                {catalogLoading && (
                  <p className="text-xs text-gray-500">Loading catalog…</p>
                )}
              </div>
            )}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Review Rule</h1>
                      <p className="mt-1 text-xs text-gray-600">
                        Review rule details before making updates.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Draft Rule
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                          Rule Name
                        </p>
                        <p className="text-xs font-medium text-gray-900">{name || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <UserRound className="h-4 w-4 text-blue-600" />
                          Owner
                        </p>
                        <p className="text-xs font-medium text-gray-900">
                          {selectedOwnerLabel || owner || "-"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <FolderTree className="h-4 w-4 text-blue-600" />
                          Business Process Name
                        </p>
                        <p className="text-xs font-medium text-gray-900">
                          {selectedBps[0]
                            ? `${selectedBps[0].id} - ${selectedBps[0].name}`
                            : bpSearch || "-"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <FolderTree className="h-4 w-4 text-blue-600" />
                          Tags
                        </p>
                        <p className="text-xs font-medium text-gray-900">{tags || "-"}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Description
                      </p>
                      <p className="text-xs leading-5 text-gray-900 whitespace-pre-wrap">
                        {description || "-"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Catalog
                      </p>
                      {cartItems.length === 0 ? (
                        <p className="text-xs leading-5 text-gray-500">No catalog item selected.</p>
                      ) : (
                        <ul className="space-y-2">
                          {cartItems.map((item) => (
                            (() => {
                              const role = getRoleByCartItemId(item.id);
                              const appName = getApplicationNameFromRole(role);
                              const showTraining = hasTrainingCheck(role);

                              return (
                                <li
                                  key={item.id}
                                  className="rounded-md border border-gray-200 px-3 py-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-gray-900 truncate">{item.name}</span>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      {item.risk ? (
                                        <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                                          {item.risk} Risk
                                        </span>
                                      ) : null}
                                      {appName ? (
                                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                          {appName}
                                        </span>
                                      ) : null}
                                      {showTraining ? (
                                        <span className="rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                          Training Check
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </li>
                              );
                            })()
                          ))}
                        </ul>
                      )}
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
}

