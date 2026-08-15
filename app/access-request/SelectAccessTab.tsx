"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, ShoppingCart, Users, Check, User, Info, Calendar, ChevronDown, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import HorizontalTabs from "@/components/HorizontalTabs";
import CustomPagination from "@/components/agTable/CustomPagination";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import AddDetailsSidebarContent, { getRiskColor, type Role } from "./AddDetailsSidebarContent";
import { getLogoSrc } from "@/components/MsAsyncData";

// Normalize catalog role type
function roleType(role: Role): string {
  return (
    role.type ??
    (role.catalogRow?.type as string | undefined) ??
    ""
  )
    .toString()
    .trim()
    .toLowerCase();
}

function getApplicationName(role: Role): string {
  const row = role.catalogRow;
  if (!row || typeof row !== "object") return "";
  const v =
    (row.applicationname as string) ??
    (row.applicationName as string) ??
    (row.application_name as string) ??
    (row.appname as string) ??
    (row.appName as string) ??
    "";
  return typeof v === "string" ? v.trim() : "";
}

function getApplicationId(role: Role): string | undefined {
  const row = role.catalogRow;
  if (!row || typeof row !== "object") return undefined;
  const v =
    (row.appinstanceid as string) ??
    (row.appInstanceId as string) ??
    (row.app_instance_id as string) ??
    "";
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
}

// Normalize the primary id used to match roles against cart and preselected ids
function getRoleId(role: Role): string {
  const row = role.catalogRow as any;
  const raw =
    (role.id as string | undefined) ??
    (row?.catalogid as string | undefined) ??
    (row?.entitlementid as string | undefined) ??
    (row?.entitlement_id as string | undefined) ??
    (row?.id as string | undefined) ??
    "";
  return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  department?: string;
  jobTitle?: string;
}

interface SelectAccessTabProps {
  onApply?: () => void;
  rolesFromApi?: Role[];
  apiCurrentPage?: number;
  onApiPageChange?: (page: number) => void;
  applicationInstances?: Array<{ id: string; name: string }>;
  selectedAppInstanceId?: string | null;
  onAppInstanceChange?: (id: string | null) => void;
  showApplicationInstancesOnly?: boolean;
  onShowApplicationInstancesOnlyChange?: (checked: boolean) => void;
  onCatalogTypeChange?: (value: string) => void;
  onTagSearch?: (tag: string) => void;
  /** Optional: hide Recommended tab (for simplified flows) */
  hideRecommendedTab?: boolean;
  /** Optional: hide Add Details sidebar button in catalog list */
  hideAddDetailsSidebar?: boolean;
  /** Optional: preselect access ids (used for edit business role) */
  preselectedAccessIds?: string[];
  /** Optional: preselect access names (used when ids differ between policy and catalog) */
  preselectedAccessNames?: string[];
}

const SelectAccessTab: React.FC<SelectAccessTabProps> = ({
  onApply,
  rolesFromApi,
  apiCurrentPage = 1,
  onApiPageChange,
  applicationInstances = [],
  selectedAppInstanceId = null,
  onAppInstanceChange,
  showApplicationInstancesOnly = false,
  onShowApplicationInstancesOnlyChange,
  onCatalogTypeChange,
  onTagSearch,
  hideRecommendedTab = false,
  hideAddDetailsSidebar = false,
  preselectedAccessIds,
  preselectedAccessNames,
}) => {
  const { addToCart, removeFromCart, isInCart, cartCount, items: cartItems } = useCart();
  const { openSidebar, closeSidebar } = useRightSidebar();
  
  // Mirror Access state - moved to parent to persist across tab switches
  const [mirrorAccessState, setMirrorAccessState] = useState<{
    selectedUser: User | null;
    userAccess: Role[];
    selectedAccessIds: Set<string>;
  }>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mirrorAccessState');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            selectedUser: parsed.selectedUser,
            userAccess: parsed.userAccess || [],
            selectedAccessIds: new Set(parsed.selectedAccessIds || []),
          };
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return {
      selectedUser: null,
      userAccess: [],
      selectedAccessIds: new Set(),
    };
  });
  
  // Initialize activeTab - default to Mirror Access (2) if user is selected, otherwise 0
  const [activeTab, setActiveTab] = useState(() => {
    // In edit mode (preselectedAccessIds present), always start on "All" tab
    if (preselectedAccessIds && preselectedAccessIds.length > 0) {
      return 0;
    }
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("selectAccessActiveTab");
        if (saved !== null) {
          return parseInt(saved, 10);
        }
        // Check if Mirror Access has a selected user
        const mirrorState = localStorage.getItem("mirrorAccessState");
        if (mirrorState) {
          const parsed = JSON.parse(mirrorState);
          if (parsed.selectedUser) {
            return 2; // Mirror Access tab
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return 0; // Default to All tab
  });
  
  // Save activeTab to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectAccessActiveTab', activeTab.toString());
    }
  }, [activeTab]);
  
  // Save mirrorAccessState to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mirrorAccessState', JSON.stringify({
          selectedUser: mirrorAccessState.selectedUser,
          userAccess: mirrorAccessState.userAccess,
          selectedAccessIds: Array.from(mirrorAccessState.selectedAccessIds),
        }));
      } catch (e) {
        // Ignore save errors
      }
    }
  }, [mirrorAccessState]);
  
  // Roles data: populated from API-driven catalog (passed from parent)
  const roles: Role[] = rolesFromApi || [];

  // When editing an existing Business Role, pre-select access by id
  const hasAppliedPreselectionRef = useRef(false);
  useEffect(() => {
    if (!preselectedAccessIds || preselectedAccessIds.length === 0) return;
    if (hasAppliedPreselectionRef.current) return;
    if (!roles || roles.length === 0) return;

    const idSet = new Set(preselectedAccessIds.map((id) => id.trim()).filter(Boolean));
    if (idSet.size === 0) return;

    roles.forEach((role) => {
      const id = String(role.id ?? "").trim();
      if (!id || !idSet.has(id)) return;
      if (isInCart(id)) return;
      addToCart({ id, name: role.name, risk: role.risk });
    });

    hasAppliedPreselectionRef.current = true;
  }, [preselectedAccessIds, roles, addToCart, isInCart]);

  const catalogTypeOptions = [
    { value: "All", label: "All" },
    { value: "Applications", label: "Applications" },
    { value: "Entitlement", label: "Entitlement" },
    { value: "Roles", label: "Roles" },
    { value: "Tags", label: "Tags" },
  ] as const;
  type CatalogTypeValue = (typeof catalogTypeOptions)[number]["value"];
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<CatalogTypeValue>("All");

  // Free–form tag filter when catalogTypeFilter === "Tags" (applied on Search click to avoid remount/focus loss)
  const [tagFilter, setTagFilter] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  // When Entitlement is selected: filter by these app instance ids; empty = "All Apps"
  const [entitlementSelectedAppIds, setEntitlementSelectedAppIds] = useState<string[]>([]);
  const [entitlementAppsDropdownOpen, setEntitlementAppsDropdownOpen] = useState(false);
  const entitlementAppsDropdownRef = useRef<HTMLDivElement>(null);
  const [entitlementAppSearch, setEntitlementAppSearch] = useState("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (entitlementAppsDropdownRef.current && !entitlementAppsDropdownRef.current.contains(e.target as Node)) {
        setEntitlementAppsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync dropdown "Applications" with Application Instances checkbox: same API query and results
  useEffect(() => {
    if (showApplicationInstancesOnly) {
      setCatalogTypeFilter("Applications");
    } else if (catalogTypeFilter === "Applications") {
      setCatalogTypeFilter("All");
    }
  }, [showApplicationInstancesOnly]);

  const handleCatalogTypeChange = (value: CatalogTypeValue) => {
    setCatalogTypeFilter(value);
    onCatalogTypeChange?.(value);
    if (value === "Applications") {
      onShowApplicationInstancesOnlyChange?.(true);
    } else {
      onShowApplicationInstancesOnlyChange?.(false);
    }
  };

  // All Tab Component (uses apiCurrentPage from parent so fetch offset increases correctly)
  const AllTab: React.FC = () => {
    const isInitialMount = React.useRef(true);
    const pageSize = 100;
    const currentPage = apiCurrentPage;

    // Catalog search is local to AllTab so typing doesn't remount the tab
    const [catalogSearchQuery, setCatalogSearchQuery] = useState("");

    const matchesCatalogTypeFilter = (role: Role): boolean => {
      if (catalogTypeFilter === "All" || catalogTypeFilter === "Tags") return true;
      const t = roleType(role);
      if (catalogTypeFilter === "Applications") return t === "applicationinstance";
      if (catalogTypeFilter === "Entitlement") return t === "entitlement";
      if (catalogTypeFilter === "Roles") return t === "role" || t === "roles";
      return true;
    };

    // Precompute preselected ids (edit mode) as a Set for quick lookup
    const preselectedIdSet = React.useMemo(
      () =>
        new Set(
          (preselectedAccessIds || [])
            .map((id) => (id ? String(id).trim() : ""))
            .filter(Boolean)
        ),
      [preselectedAccessIds]
    );

    const preselectedNameSet = React.useMemo(
      () =>
        new Set(
          (preselectedAccessNames || []).map((n) =>
            n ? String(n).toLowerCase().trim() : ""
          ).filter(Boolean)
        ),
      [preselectedAccessNames]
    );

    // Filter roles coming from catalog API; selected items are highlighted in-place.
    const filteredRoles = roles.filter((role) => {
      const matchesSearch = role.name.toLowerCase().includes(catalogSearchQuery.toLowerCase());
      const matchesAppInstance =
        !showApplicationInstancesOnly ? true : roleType(role) === "applicationinstance";
      const matchesType = matchesCatalogTypeFilter(role);
      const matchesEntitlementApps =
        catalogTypeFilter !== "Entitlement" ||
        entitlementSelectedAppIds.length === 0 ||
        (() => {
          const appId = getApplicationId(role);
          return appId && entitlementSelectedAppIds.includes(appId);
        })();
      const lowerTagFilter = tagFilter.trim().toLowerCase();
      const matchesTags =
        catalogTypeFilter !== "Tags" ||
        lowerTagFilter === "" ||
        role.name.toLowerCase().includes(lowerTagFilter) ||
        role.description.toLowerCase().includes(lowerTagFilter);
      return matchesSearch && matchesAppInstance && matchesType && matchesEntitlementApps && matchesTags;
    });

    // When editing (cart pre-populated), ensure selected access appears first
    // After catalog roles are loaded, ensure any preselected ids from edit mode are
    // also added to the cart so they appear visually selected in the list.
    useEffect(() => {
      if (!preselectedIdSet.size && !preselectedNameSet.size) return;
      if (!roles || roles.length === 0) return;

      roles.forEach((role) => {
        const normalizedId = getRoleId(role);
        const normalizedName = role.name ? role.name.toLowerCase().trim() : "";
        const matchesId =
          normalizedId && preselectedIdSet.has(normalizedId || "");
        const matchesName =
          normalizedName && preselectedNameSet.has(normalizedName);
        if (!matchesId && !matchesName) return;
        const cartId = normalizedId || normalizedName || role.name;
        if (!cartId) return;
        if (isInCart(cartId)) return;
        addToCart({ id: cartId, name: role.name, risk: role.risk });
      });
    }, [roles, preselectedIdSet, preselectedNameSet, addToCart, isInCart]);

    const sortedRoles = filteredRoles;

    // Server-side pagination (100 rows per API page) – show all roles from current API page
    const isLastServerPage = filteredRoles.length < pageSize;
    const totalPages = isLastServerPage ? currentPage : currentPage + 1;

    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      // Reset to first page only when user actually changes search or dropdown (not on mount/remount)
      if (onApiPageChange) onApiPageChange(1);
    }, [catalogSearchQuery, showApplicationInstancesOnly, catalogTypeFilter, entitlementSelectedAppIds]);

    const handleAddToCart = (role: Role) => {
      const id = getRoleId(role);
      if (!id) return;
      if (isInCart(id)) {
        removeFromCart(id);
      } else {
        addToCart({ id, name: role.name, risk: role.risk });
      }
    };

    const handleReview = () => {
      console.log("Reviewing cart items:", cartCount);
    };

    const handlePageChange = (page: number) => {
      if (onApiPageChange) onApiPageChange(page);
    };

    return (
      <div className="w-full">
        {/* Search and Filter Section */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3 md:gap-4">
            <div className="relative w-[320px] flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Catalog"
                value={catalogSearchQuery}
                onChange={(e) => setCatalogSearchQuery(e.target.value)}
                className="h-10 w-full pl-10 pr-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="relative w-[320px] flex-shrink-0">
              <select
                value={catalogTypeFilter}
                onChange={(e) => handleCatalogTypeChange(e.target.value as CatalogTypeValue)}
                className="h-10 w-full appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {catalogTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {catalogTypeFilter === "Tags" && (
              <div className="w-[360px] flex-shrink-0 flex items-center gap-2">
                <input
                  ref={tagInputRef}
                  type="text"
                  placeholder="Enter tag"
                  defaultValue={tagFilter}
                  className="h-10 w-full flex-1 bg-white border border-gray-300 rounded-md px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = tagInputRef.current?.value?.trim() ?? "";
                    setTagFilter(value);
                    onTagSearch?.(value);
                  }}
                  className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md whitespace-nowrap"
                >
                  Search
                </button>
              </div>
            )}
            {catalogTypeFilter === "Entitlement" && (
              <div className="relative w-[320px] flex-shrink-0" ref={entitlementAppsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setEntitlementAppsDropdownOpen((o) => !o)}
                  className="h-10 w-full flex items-center justify-between gap-2 bg-white border border-gray-300 rounded-md pl-4 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-left"
                >
                  <span className="truncate">
                    {entitlementSelectedAppIds.length === 0
                      ? "All Apps"
                      : entitlementSelectedAppIds.length === 1
                        ? applicationInstances.find((a) => a.id === entitlementSelectedAppIds[0])?.name ?? "1 application"
                        : `${entitlementSelectedAppIds.length} applications selected`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 absolute right-2 top-1/2 -translate-y-1/2" />
                </button>
                {entitlementAppsDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 flex flex-col">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        placeholder="Search applications..."
                        value={entitlementAppSearch}
                        onChange={(e) => setEntitlementAppSearch(e.target.value)}
                        className="w-full h-9 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 min-h-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEntitlementSelectedAppIds([]);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${entitlementSelectedAppIds.length === 0 ? "bg-blue-50 text-blue-700 font-medium" : ""}`}
                      >
                        <span className={entitlementSelectedAppIds.length === 0 ? "font-medium" : ""}>All Apps</span>
                        {entitlementSelectedAppIds.length === 0 && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                      {applicationInstances
                        .filter(
                          (app) =>
                            !entitlementAppSearch.trim() ||
                            app.name.toLowerCase().includes(entitlementAppSearch.toLowerCase())
                        )
                        .map((app) => {
                          const isSelected = entitlementSelectedAppIds.includes(app.id);
                          return (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => {
                                setEntitlementSelectedAppIds((prev) =>
                                  prev.includes(app.id) ? prev.filter((id) => id !== app.id) : [...prev, app.id]
                                );
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${isSelected ? "bg-blue-50 text-blue-700" : ""}`}
                            >
                              <span className="truncate">{app.name}</span>
                              {isSelected && <Check className="w-4 h-4 shrink-0 ml-auto" />}
                            </button>
                          );
                        })}
                      {applicationInstances.filter(
                        (app) =>
                          !entitlementAppSearch.trim() ||
                          app.name.toLowerCase().includes(entitlementAppSearch.toLowerCase())
                      ).length === 0 && entitlementAppSearch.trim() && (
                        <div className="px-4 py-3 text-sm text-gray-500">No applications match your search.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleReview}
            className="h-10 shrink-0 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-md font-medium transition-colors relative"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Pagination at top */}
        {filteredRoles.length > 0 && (
          <div className="mb-4">
            <CustomPagination
              totalItems={(currentPage - 1) * pageSize + filteredRoles.length}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              pageSizeOptions={[100]}
            />
          </div>
        )}

        {/* Roles List (all roles from current API page) */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <div className="space-y-3">
          {sortedRoles.map((role) => {
            const normalizedId = getRoleId(role);
            const inCartById = normalizedId ? isInCart(normalizedId) : false;
            const roleNameNorm = role.name ? role.name.toLowerCase().trim() : "";
            const inCartByName =
              roleNameNorm &&
              cartItems.some(
                (item) => item.name.toLowerCase().trim() === roleNameNorm
              );
            const isPreselected =
              (normalizedId ? preselectedIdSet.has(normalizedId) : false) ||
              (roleNameNorm ? preselectedNameSet.has(roleNameNorm) : false);
            const isSelected = inCartById || inCartByName || isPreselected;
            return (
              <div
                key={normalizedId || role.id}
                className={`flex items-center justify-between rounded-lg p-4 transition-colors ${
                  isSelected
                    ? "bg-blue-50 hover:bg-blue-100 ring-2 ring-blue-400"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
                aria-selected={isSelected}
              >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded overflow-hidden shrink-0">
                  {roleType(role) === "applicationinstance" ? (
                    <img
                      src={getLogoSrc(getApplicationName(role) || role.name)}
                      alt=""
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <Users className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-gray-800 font-medium">{role.name}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(
                        role.risk
                      )}`}
                    >
                      {role.risk} Risk
                    </span>
                    {getApplicationName(role) && (
                      <span className="px-2 py-1 rounded text-xs font-medium border text-blue-700 bg-blue-50 border-blue-200">
                        {getApplicationName(role)}
                      </span>
                    )}
                    {(() => {
                      const jit =
                        (role.catalogRow?.jit_access as string | undefined) ??
                        (role.catalogRow?.jitAccess as string | undefined) ??
                        (role.catalogRow?.JIT_ACCESS as string | undefined);
                      return typeof jit === "string" && jit.toLowerCase() === "yes";
                    })() && (
                      <span className="px-2 py-1 rounded text-xs font-medium border text-[#E0745A] bg-[#E0745A]/15 border-[#E0745A]">
                        JIT Access
                      </span>
                    )}
                    {(() => {
                      const raw = role.catalogRow?.training_code as unknown;
                      const arr = Array.isArray(raw) ? raw : [];
                      if (arr.length === 0) return null;
                      const first = arr[0] as Record<string, unknown>;
                      const code = String(first.code ?? "").trim();
                      if (!code) return null;
                      return (
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor("Low")}`}>
                          Training Check
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </div>
              </div>
                <div className="flex items-center gap-3">
                {!hideAddDetailsSidebar && (
                  <button
                    onClick={() => {
                      const addToCartForRole = () => {
                        if (!isInCart(role.id)) addToCart({ id: role.id, name: role.name, risk: role.risk });
                        closeSidebar();
                      };
                      openSidebar(
                        <AddDetailsSidebarContent
                          role={role}
                          riskClass={getRiskColor(role.risk)}
                          onAddToCart={addToCartForRole}
                        />,
                        { widthPx: 500, title: "Add Details" }
                      );
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm"
                  >
                    Add Details
                  </button>
                )}
                <button
                  onClick={() => handleAddToCart(role)}
                  className={`inline-flex items-center justify-center px-3 py-2 rounded-md font-medium transition-colors ${
                    isSelected
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  {isSelected ? "Selected" : "Select"}
                </button>
              </div>
            </div>
            );
          })}
          </div>
        </div>

        {filteredRoles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Loading...
          </div>
        )}
        {/* Pagination Controls (project-wide CustomPagination) */}
        {filteredRoles.length > 0 && (
          <div className="mt-4">
            <CustomPagination
              totalItems={(currentPage - 1) * pageSize + filteredRoles.length}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              pageSizeOptions={[100]}
            />
          </div>
        )}
      </div>
    );
  };

  // Recommended Tab Component
  const RecommendedTab: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");

    // Seed ~18 dummy recommended access items for demo purposes
    const dummyRecommended: Role[] = [
      {
        id: "rec-001",
        name: "SAP Finance Analyst",
        risk: "Medium",
        description: "Core finance operations access in SAP for journal entry processing.",
        type: "Entitlement",
      },
      {
        id: "rec-002",
        name: "SAP AP Specialist",
        risk: "Medium",
        description: "Accounts payable processing access including invoice posting.",
        type: "Entitlement",
      },
      {
        id: "rec-003",
        name: "SAP AR Specialist",
        risk: "Low",
        description: "Accounts receivable access for collections and cash application.",
        type: "Entitlement",
      },
      {
        id: "rec-004",
        name: "Workday HR View Only",
        risk: "Low",
        description: "Read-only access to worker profiles and org structure in Workday.",
        type: "Entitlement",
      },
      {
        id: "rec-005",
        name: "Workday HR Partner",
        risk: "High",
        description: "HR partner role with ability to update employee attributes.",
        type: "Entitlement",
      },
      {
        id: "rec-006",
        name: "Salesforce Sales User",
        risk: "Low",
        description: "Standard sales cloud access to accounts, opportunities and reports.",
        type: "Entitlement",
      },
      {
        id: "rec-007",
        name: "Salesforce Sales Manager",
        risk: "Medium",
        description: "Manager access including pipeline dashboards and team forecasts.",
        type: "Entitlement",
      },
      {
        id: "rec-008",
        name: "Oracle Fusion GL Inquiry",
        risk: "Low",
        description: "Inquiry-only access to general ledger balances and journals.",
        type: "Entitlement",
      },
      {
        id: "rec-009",
        name: "Oracle Fusion GL Accountant",
        risk: "High",
        description: "Posting and adjustment capabilities for general ledger.",
        type: "Entitlement",
      },
      {
        id: "rec-010",
        name: "CornerStone LMS Learner",
        risk: "Low",
        description: "Standard learner access to assigned training and catalogs.",
        type: "Entitlement",
      },
      {
        id: "rec-011",
        name: "CornerStone LMS Admin",
        risk: "High",
        description: "LMS administration including curriculum and user management.",
        type: "Entitlement",
      },
      {
        id: "rec-012",
        name: "ServiceNow ITIL User",
        risk: "Medium",
        description: "ITIL access for incident, problem and change management.",
        type: "Entitlement",
      },
      {
        id: "rec-013",
        name: "ServiceNow Request Approver",
        risk: "Low",
        description: "Approver access for service catalog requests.",
        type: "Entitlement",
      },
      {
        id: "rec-014",
        name: "Okta App Administrator",
        risk: "High",
        description: "Application assignment and policy management in Okta.",
        type: "Entitlement",
      },
      {
        id: "rec-015",
        name: "Okta Read Only Admin",
        risk: "Low",
        description: "Read-only access to Okta directory and application configuration.",
        type: "Entitlement",
      },
      {
        id: "rec-016",
        name: "Jira Project Contributor",
        risk: "Low",
        description: "Issue create and transition access for software projects.",
        type: "Entitlement",
      },
      {
        id: "rec-017",
        name: "Jira Project Administrator",
        risk: "Medium",
        description: "Project configuration and workflow management in Jira.",
        type: "Entitlement",
      },
      {
        id: "rec-018",
        name: "Concur Expense User",
        risk: "Low",
        description: "Standard user access for expense report creation and submission.",
        type: "Entitlement",
      },
    ];

    // Combine dummy + any API-backed recommended roles, cap at ~18
    const recommendedRoles: Role[] = [...dummyRecommended, ...roles].slice(0, 18);
    const filteredRoles = recommendedRoles.filter((role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddToCart = (role: Role) => {
      if (isInCart(role.id)) {
        removeFromCart(role.id);
      } else {
        addToCart({ id: role.id, name: role.name, risk: role.risk });
      }
    };

    return (
      <div className="w-full">
        {/* Search Section */}
        <div className="mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search Recommended Roles"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Recommended Roles List */}
        <div className="space-y-3">
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between bg-gray-100 hover:bg-gray-200 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded overflow-hidden shrink-0">
                  {roleType(role) === "applicationinstance" ? (
                    <img
                      src={getLogoSrc(getApplicationName(role) || role.name)}
                      alt=""
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <Users className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-gray-800 font-medium">{role.name}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(
                        role.risk
                      )}`}
                    >
                      {role.risk} Risk
                    </span>
                    {getApplicationName(role) && (
                      <span className="px-2 py-1 rounded text-xs font-medium border text-blue-700 bg-blue-50 border-blue-200">
                        {getApplicationName(role)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-gray-300 rounded-full transition-colors">
                  <Info className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => handleAddToCart(role)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                    isInCart(role.id)
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isInCart(role.id) ? "Remove" : "Add To Cart"}
                </button>
                <button className="p-2 hover:bg-gray-300 rounded-full transition-colors">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredRoles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No recommended roles found matching your search.
          </div>
        )}
      </div>
    );
  };

  // Mirror Access Tab Component
  const MirrorAccessTab: React.FC = () => {
    const { addToCart, removeFromCart, isInCart, cartCount } = useCart();
    const [searchValue, setSearchValue] = useState("");
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isRetrieving, setIsRetrieving] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    
    // Use state from parent component
    const { selectedUser, userAccess, selectedAccessIds } = mirrorAccessState;
    
    const setSelectedUser = (user: User | null) => {
      setMirrorAccessState(prev => ({ ...prev, selectedUser: user }));
    };
    
    const setUserAccess = (access: Role[]) => {
      setMirrorAccessState(prev => ({ ...prev, userAccess: access }));
    };
    
    const setSelectedAccessIds = (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setMirrorAccessState(prev => ({
        ...prev,
        selectedAccessIds: typeof ids === 'function' ? ids(prev.selectedAccessIds) : ids
      }));
    };

    const handleAddSelectedToCart = () => {
      if (!userAccess.length || !selectedAccessIds.size) return;
      userAccess.forEach((access) => {
        if (selectedAccessIds.has(access.id) && !isInCart(access.id)) {
          addToCart({ id: access.id, name: access.name, risk: access.risk });
        }
      });
    };

    const handleRemoveSelectedFromCart = () => {
      if (!userAccess.length || !selectedAccessIds.size) return;
      userAccess.forEach((access) => {
        if (selectedAccessIds.has(access.id) && isInCart(access.id)) {
          removeFromCart(access.id);
        }
      });
    };

    // Mock function to retrieve user access
    const mockRetrieveAccess = (userId: string): Role[] => {
      // Return some roles as user's access (for demo purposes)
      return roles.slice(0, 3);
    };

    // API call to search users
    const handleSearch = async () => {
      if (!searchValue.trim()) {
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setSearchResults([]);
      setHasSearched(true);

      try {
        // Build query to get all users with specified fields
        const query = `SELECT firstname, lastname, email, username, employeeid, department, title FROM usr`;

        const response = await fetch(
          "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: query,
              parameters: [],
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle the response format - data is in resultSet
        let usersData: any[] = [];
        if (data?.resultSet && Array.isArray(data.resultSet)) {
          // Normalize the email field from different formats
          usersData = data.resultSet.map((user: any) => {
            let emailValue = "";
            
            // Handle email field - can be object, array, or missing
            if (user.email) {
              if (typeof user.email === "string") {
                emailValue = user.email;
              } else if (user.email.work) {
                // Format: { "work": "email@example.com" }
                emailValue = user.email.work;
              } else if (Array.isArray(user.email) && user.email.length > 0) {
                // Format: [{ "type": "work", "value": "email@example.com", "primary": true }]
                // Find primary email or first email
                const primaryEmail = user.email.find((e: any) => e.primary) || user.email[0];
                emailValue = primaryEmail?.value || "";
              }
            }
            
            // Construct name from firstname and lastname
            let nameValue = "";
            if (user.firstname || user.lastname) {
              const firstName = user.firstname || "";
              const lastName = user.lastname || "";
              nameValue = `${firstName} ${lastName}`.trim();
            } else {
              nameValue = user.username || "";
            }
            
            return {
              name: nameValue,
              email: emailValue,
              username: user.username || "",
              employeeid: (user.employeeid || "").toString(),
              department: user.department || "",
              jobtitle: user.title || "",
            };
          });
        }

        // Convert to User format expected by the component
        const normalizedUsers: User[] = usersData.map((user, index) => ({
          id: `user-${index}-${user.username || user.email || index}`,
          name: user.name || user.username || "",
          email: user.email,
          username: user.username,
          department: user.department || "",
          jobTitle: user.jobtitle || "",
          employeeId: user.employeeid || undefined,
        }));

        // Filter client-side based on search value
        const filteredUsers = normalizedUsers.filter((user) => {
          const searchLower = searchValue.toLowerCase().trim();
          if (!searchLower) return false;
          
          return (
            user.name?.toLowerCase().includes(searchLower) ||
            user.username?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.department?.toLowerCase().includes(searchLower) ||
            user.jobTitle?.toLowerCase().includes(searchLower) ||
            user.employeeId?.toLowerCase().includes(searchLower)
          );
        });

        setSearchResults(filteredUsers);
      } catch (error) {
        console.error("Error fetching users from API:", error);
        setSearchError(error instanceof Error ? error.message : "Failed to fetch users");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const handleUserSelect = (user: User) => {
      setSelectedUser(user);
      setUserAccess([]);
      setSelectedAccessIds(new Set());
    };

    const handleRetrieveAccess = () => {
      if (selectedUser) {
        setIsRetrieving(true);
        setTimeout(() => {
          const access = mockRetrieveAccess(selectedUser.id);
          setUserAccess(access);
          setIsRetrieving(false);
        }, 500);
      }
    };

    const handleAccessToggle = (accessId: string) => {
      setSelectedAccessIds((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(accessId)) {
          newSelected.delete(accessId);
        } else {
          newSelected.add(accessId);
        }
        return newSelected;
      });
    };

    const handleSelectAllAccess = () => {
      setSelectedAccessIds((prev) => {
        if (prev.size === userAccess.length) {
          return new Set();
        } else {
          return new Set(userAccess.map((a) => a.id));
        }
      });
    };

    const handleApply = () => {
      // Add selected access to cart
      const selectedIds = Array.from(selectedAccessIds);
      selectedIds.forEach((accessId) => {
        const access = userAccess.find((a) => a.id === accessId);
        if (access && !isInCart(access.id)) {
          addToCart({ id: access.id, name: access.name, risk: access.risk });
        }
      });
      
      // Navigate to next step (Details)
      if (onApply) {
        onApply();
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    };

    return (
      <div className="w-full">
        {/* Cart Display */}
        <div className="mb-6 flex justify-end">
          <button 
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md font-medium transition-colors relative"
            title="View cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* User Search Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search User
          </label>
          <div className="flex gap-4 items-end">
            <div className="relative flex-1 max-w-md">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by name, username, email, department, job title..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchValue.trim() || isSearching}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                searchValue.trim() && !isSearching
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {isSearching && (
          <div className="mb-6 p-4 text-center text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Searching users...
            </div>
          </div>
        )}

        {/* Error Message */}
        {!isSearching && searchError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              Error: {searchError}
            </p>
          </div>
        )}

        {/* No Results Message */}
        {!isSearching && !searchError && hasSearched && searchResults.length === 0 && (
          <div className="mb-6 p-4 text-center text-gray-500">
            No users found matching "{searchValue}"
          </div>
        )}

        {!isSearching && !searchError && searchResults.length > 0 && !selectedUser && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Search Results ({searchResults.length})
            </h3>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="flex items-center gap-3 p-4 border-b border-gray-200 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <span className="text-xs text-gray-500">({user.username})</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                      {user.department && (
                        <p className="text-xs text-gray-500 mt-1">
                          {user.department} {user.jobTitle && `• ${user.jobTitle}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Selected User Display */}
        {selectedUser && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{selectedUser.name}</p>
                <p className="text-sm text-gray-600">{selectedUser.email}</p>
                {selectedUser.department && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedUser.department} {selectedUser.jobTitle && `• ${selectedUser.jobTitle}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserAccess([]);
                  setSelectedAccessIds(new Set());
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Change User
              </button>
            </div>
          </div>
        )}

        {/* Retrieve Access Button */}
        {selectedUser && userAccess.length === 0 && (
          <div className="mb-6">
            <button
              onClick={handleRetrieveAccess}
              disabled={isRetrieving}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isRetrieving
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isRetrieving ? "Retrieving..." : "Retrieve Access"}
            </button>
          </div>
        )}

        {/* User Access List */}
        {isRetrieving && (
          <div className="mb-6 p-4 text-center text-gray-500">
            Retrieving user access...
          </div>
        )}

        {userAccess.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                User Access ({userAccess.length})
              </h3>
              <button
                onClick={handleSelectAllAccess}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedAccessIds.size === userAccess.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="space-y-3">
              {userAccess.map((access) => {
                const isSelected = selectedAccessIds.has(access.id);
                const inCart = isInCart(access.id);
                return (
                  <div
                    key={access.id}
                    className={`flex items-center justify-between bg-gray-100 hover:bg-gray-200 rounded-lg p-4 transition-colors ${
                      isSelected ? "ring-2 ring-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccessToggle(access.id);
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded">
                        <Users className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-gray-800 font-medium">{access.name}</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(
                              access.risk
                            )}`}
                          >
                            {access.risk} Risk
                          </span>
                          {getApplicationName(access) && (
                            <span className="px-2 py-1 rounded text-xs font-medium border text-blue-700 bg-blue-50 border-blue-200">
                              {getApplicationName(access)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{access.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (inCart) {
                            removeFromCart(access.id);
                          } else {
                            addToCart({ id: access.id, name: access.name, risk: access.risk });
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                          inCart
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {inCart ? "Remove" : "Add To Cart"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Apply Button */}
        {userAccess.length > 0 && selectedAccessIds.size > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
            >
              Apply
            </button>
          </div>
        )}

        {/* Floating Add to Cart when Select All is active */}
        {userAccess.length > 0 &&
          selectedAccessIds.size === userAccess.length &&
          selectedAccessIds.size > 0 && (() => {
            const hasSelectedNotInCart = userAccess.some(
              (access) => selectedAccessIds.has(access.id) && !isInCart(access.id)
            );
            const hasSelectedInCart = userAccess.some(
              (access) => selectedAccessIds.has(access.id) && isInCart(access.id)
            );

            if (hasSelectedNotInCart) {
              // There are selected items not yet in cart → show Add button only
              return (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                  <button
                    onClick={handleAddSelectedToCart}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add Selected to Cart
                  </button>
                </div>
              );
            }

            if (hasSelectedInCart) {
              // All selected items are already in cart → show Remove button only
              return (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                  <button
                    onClick={handleRemoveSelectedFromCart}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Remove Selected from Cart
                  </button>
                </div>
              );
            }

            return null;
          })()}
      </div>
    );
  };

  const tabs = [
    {
      label: "All",
      component: AllTab,
    },
    ...(!hideRecommendedTab
      ? [
          {
            label: "Recommended",
            component: RecommendedTab,
          },
        ]
      : []),
    {
      label: "Mirror Access",
      component: MirrorAccessTab,
    },
  ];

  return (
    <div className="w-full">
      <HorizontalTabs
        tabs={tabs}
        activeIndex={activeTab}
        onChange={setActiveTab}
      />
    </div>
  );
};

export default SelectAccessTab;
