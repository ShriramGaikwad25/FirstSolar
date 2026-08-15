"use client";
import React, { useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface JitSelectAccessTabProps {
  onApply?: () => void;
  rolesFromApi?: any[];
  applicationInstances?: Array<{ id: string; name: string }>;
  selectedAppInstanceId?: string | null;
  onAppInstanceChange?: (id: string | null) => void;
  showApplicationInstancesOnly?: boolean;
  onShowApplicationInstancesOnlyChange?: (checked: boolean) => void;
  onCatalogTypeChange?: (value: string) => void;
  onTagSearch?: (tag: string) => void;
}

const COMPARTMENT_OPTIONS = ["Tenancy"];

const FILTER_OPTIONS = ["Resource Type", "Resource Family", "Tags", "Resource"];

const JitSelectAccessTab: React.FC<JitSelectAccessTabProps> = () => {
  const [selectedCompartment, setSelectedCompartment] = useState<string>("Tenancy");
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [tagSearch, setTagSearch] = useState<string>("");

  const handleTagSearch = () => {
    // tag search logic will go here
    console.log("Tag search:", tagSearch);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Compartment */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 shrink-0">
            Compartment
          </label>
          <div className="relative w-56">
            <select
              value={selectedCompartment}
              onChange={(e) => setSelectedCompartment(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {COMPARTMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Filter By */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 shrink-0">
            Filter By
          </label>
          <div className="relative w-56">
            <select
              value={selectedFilter}
              onChange={(e) => { setSelectedFilter(e.target.value); setTagSearch(""); }}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select...</option>
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Tag search — only when Tags is selected */}
        {selectedFilter === "Tags" && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTagSearch()}
              placeholder="Search tags..."
              className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleTagSearch}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JitSelectAccessTab;
