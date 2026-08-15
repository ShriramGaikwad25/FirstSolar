"use client";
import { useEffect, useState, useRef } from "react";
import Dropdown from "../Dropdown";
import { CircleX, Filter, FilterX, Check } from "lucide-react";

const statusOptions = [
  "All",
  "Pending",
  "Certify",
  "Reject",
  "Delegated",
  "Remediated",
];

const entitlementMetaStatusOptions = [
  "All",
  "Pending",
  "Approve",
];

const appInventoryStatusOptions = [
  "All",
  "Integrated",
  "In Progress",
];

const accountFilterOptions = [
  { label: "Elevated Accounts", value: "iselevated eq Y", count: 0 },
  { label: "Orphan Accounts", value: "isorphan eq Y", count: 0 },
  { label: "Terminated User Accounts", value: "isterminated eq Y", count: 0 },
  { label: "Dormant Accounts", value: "isdormant eq Y", count: 0 },
  { label: "New Access", value: "isnewaccess eq Y", count: 0 },
  { label: "Over Privileged Users", value: "isoverprivileged eq Y", count: 0 },
  { label: "Compliance Violations", value: "iscomplianceviolation eq Y", count: 0 },
];

const Filters = ({
  gridApi,
  columns = [],
  appliedFilter,
  onFilterChange,
  context = "status",
  initialSelected,
  value, // Controlled value prop
  actionStates,
  statusCounts, // Counts from certification details access block (Pending, Certify, Reject, etc.)
  disableZeroCountOptions = false,
}: {
  gridApi?: any;
  columns?: string[];
  appliedFilter?: (filters: string[]) => void;
  onFilterChange?: (filter: string) => void;
  context?: "status" | "account" | "app-inventory-status" | "entitlement-meta-status";
  initialSelected?: string;
  value?: string; // Controlled value
  actionStates?: {
    certify?: boolean;
    reject?: boolean;
    remediate?: boolean;
  };
  statusCounts?: Record<string, number>;
  /**
   * When true (used in AppOwner), status options with no matching
   * items (count === 0 or undefined) are shown disabled and cannot
   * be selected. "All" is always enabled.
   */
  disableZeroCountOptions?: boolean;
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>(value || initialSelected || "");
  const [filterCounts, setFilterCounts] = useState<{ [key: string]: number }>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenuRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Apply default selected filter on mount
    if (initialSelected) {
      setSelectedFilter(initialSelected);
      if (appliedFilter) {
        appliedFilter([initialSelected]);
      }
      if (onFilterChange) {
        if (context === "status" || context === "app-inventory-status") {
          if (context === "status" && gridApi && gridApi.current) {
            const filterInstance = gridApi.current.getFilterInstance('status');
            if (filterInstance) {
              filterInstance.setModel({
                filterType: 'text',
                type: 'equals',
                filter: initialSelected
              });
              gridApi.current.onFilterChanged();
            }
          }
        } else {
          onFilterChange(initialSelected);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync with external value changes (controlled mode)
  // Only sync with value prop, not initialSelected (which should only apply on mount)
  useEffect(() => {
    if (value !== undefined) {
      // Controlled mode: value prop takes precedence
      if (value !== selectedFilter) {
        setSelectedFilter(value);
        if (appliedFilter) {
          appliedFilter(value ? [value] : ["All"]);
        }
      }
    }
    // Note: initialSelected is intentionally NOT in dependencies - it should only apply on mount
  }, [value, appliedFilter, selectedFilter]);

  const toggleFilter = (filterValue: string) => {
    // If "All" is selected, set it as selected and pass ["All"] to callback
    if (filterValue === "All") {
      // If "All" is already selected (selectedFilter === ""), do nothing
      if (selectedFilter === "") {
        return;
      }
      // Switch to "All" from another filter
      setSelectedFilter("");
      if (appliedFilter) {
        appliedFilter(["All"]);
      }
      if (onFilterChange) {
        if (context === "status") {
          // Clear grid filter for "All" - API will fetch all actions
          if (gridApi && gridApi.current) {
            const filterInstance = gridApi.current.getFilterInstance('status');
            if (filterInstance) {
              filterInstance.setModel(null);
              gridApi.current.onFilterChanged();
            }
          }
        } else {
          // Clear API filter
          onFilterChange("");
        }
      }
      // Close the menu after selection
      if (closeMenuRef.current) {
        closeMenuRef.current();
      }
      return;
    }
    
    setSelectedFilter(selectedFilter === filterValue ? "" : filterValue);
    // Call the callback immediately when filter changes
    if (appliedFilter) {
      appliedFilter(selectedFilter === filterValue ? [] : [filterValue]);
    }
    if (onFilterChange) {
      // For status filters, we don't need to call the API filter
      // Status filters are handled by the grid's built-in filtering (status context only)
      if (context === "status") {
        // Apply grid filter instead of API filter
        if (gridApi && gridApi.current) {
          const filterInstance = gridApi.current.getFilterInstance('status');
          if (filterInstance) {
            if (selectedFilter === filterValue) {
              // Clear filter
              filterInstance.setModel(null);
            } else {
              // Apply filter
              filterInstance.setModel({
                filterType: 'text',
                type: 'equals',
                filter: filterValue
              });
            }
            gridApi.current.onFilterChanged();
          }
        }
      } else if (context !== "app-inventory-status") {
        // For account filters, use API filter
        onFilterChange(selectedFilter === filterValue ? "" : filterValue);
      }
    }
    // Close the menu after selection
    if (closeMenuRef.current) {
      closeMenuRef.current();
    }
  };

  const clearFilters = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFilter("");
    // Call the callback when clearing filters - for status context, pass ["All"] to fetch all actions
    if (appliedFilter) {
      if (context === "status" || context === "app-inventory-status") {
        appliedFilter(["All"]);
      } else {
        appliedFilter([]);
      }
    }
    if (onFilterChange) {
      if (context === "status") {
        // Clear grid filter
        if (gridApi && gridApi.current) {
          const filterInstance = gridApi.current.getFilterInstance('status');
          if (filterInstance) {
            filterInstance.setModel(null);
            gridApi.current.onFilterChanged();
          }
        }
      } else if (context !== "app-inventory-status") {
        // Clear API filter
        onFilterChange("");
      }
    }
  };

  const isActive = !!selectedFilter;

  const options = context === "account"
    ? accountFilterOptions
    : context === "app-inventory-status"
    ? appInventoryStatusOptions.map(opt => ({ label: opt, value: opt } as any))
    : context === "entitlement-meta-status"
    ? entitlementMetaStatusOptions.map(opt => ({ label: opt, value: opt } as any))
    : statusOptions.map(opt => ({ label: opt, value: opt } as any));

  return (
    <div className={`relative ${isActive ? "w-fit" : "w-44"}`}>
      {}

      <Dropdown
        Icon={
          selectedFilter
            ? () => (
                <div className="inline-flex h-8 items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md border border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <FilterX size={14} className="text-gray-600" />
                    <small className="text-sm font-medium text-gray-800">
                      {options.find(opt => opt.value === selectedFilter)?.label || selectedFilter}
                    </small>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilters(e);
                    }}
                    title="Clear Filters"
                    className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        clearFilters(e as any);
                      }
                    }}
                  >
                    <CircleX color="#fff" size={14} />
                  </div>
                </div>
              )
            : () => (
                <div className="flex h-8 items-center gap-2 px-2 w-full">
                  <Filter />
                  <small>All</small>
                </div>
              )
        }
        className={`h-8 inline-flex items-center justify-center ${isActive ? "bg-[#6D6E73]/20" : ""}`}
        onCloseMenu={(closeFunc) => {
          closeMenuRef.current = closeFunc;
        }}
      >
        <li className="px-4 pb-2 border-b border-b-gray-300 font-semibold mb-2">
          {context === "account" ? "Filters" : context === "app-inventory-status" ? "Filter by Status" : "Filter by Status"}
        </li>
        {options.map((option) => {
          // For "All", show as selected when no filter is selected
          const isSelected = option.value === "All" 
            ? !selectedFilter 
            : selectedFilter === option.value;
          const count = context === "status" && statusCounts
            ? statusCounts[option.value]
            : filterCounts[option.value] || (option as any).count;
          const showCount = context === "account" || (context === "status" && statusCounts != null);
          const isDisabled =
            disableZeroCountOptions &&
            context === "status" &&
            option.value !== "All" &&
            (!count || Number(count) === 0);
          return (
            <li
              key={option.value}
              onClick={() => {
                if (isDisabled) return;
                toggleFilter(option.value);
              }}
              className={`px-2 py-2 flex items-center justify-between ${
                isDisabled
                  ? "cursor-not-allowed text-gray-400"
                  : "cursor-pointer hover:bg-gray-100"
              } ${isSelected ? "bg-blue-50 font-semibold" : ""}`}
            >
              <div className="flex items-center">
                <span className="mx-2 w-4 flex justify-center">
                  {isSelected ? (
                    <>
                      {(option.value === "Certify" || option.value === "Remediated") ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-600">
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </span>
                      ) : (
                        <Check size={16} className="text-blue-600" />
                      )}
                    </>
                  ) : (
                    <span className="w-4" />
                  )}
                </span>
                <span
                  className={
                    option.label === "Terminated User Accounts" || isDisabled
                      ? "text-gray-400"
                      : ""
                  }
                >
                  {option.label}
                </span>
              </div>
              {showCount && (
                <span className={`text-xs px-2 py-1 rounded ${
                  isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                }`}>
                  {typeof count === "number" ? count : 0}
                </span>
              )}
            </li>
          );
        })}
        {context === "account" && (
          <li className="px-2 py-2 border-t border-gray-200 mt-2">
            <button
              onClick={clearFilters}
              className="flex items-center text-gray-600 hover:text-gray-800 text-sm"
            >
              <FilterX size={14} className="mr-2" />
              Clear Filters
            </button>
          </li>
        )}
      </Dropdown>
    </div>
  );
};

export default Filters;