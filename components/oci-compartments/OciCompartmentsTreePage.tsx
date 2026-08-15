"use client";

import { useState } from "react";
import { Network, RotateCw, WifiOff } from "lucide-react";
import { useOciCompartmentsTree } from "@/hooks/useOciCompartmentsTree";
import { CompartmentGraphView } from "@/components/oci-compartments/CompartmentGraphView";
import { CompartmentPathsView } from "@/components/oci-compartments/CompartmentPathsView";

type CompartmentTab = "hierarchy" | "paths";

const TABS: { id: CompartmentTab; label: string }[] = [
  { id: "hierarchy", label: "Hierarchy" },
  { id: "paths", label: "Paths" },
];

/** Main area below fixed header (60px) and main padding (p-6). */
const PAGE_HEIGHT_CLASS = "h-[calc(100vh-108px)] max-h-[calc(100vh-108px)]";

export default function OciCompartmentsTreePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useOciCompartmentsTree();
  const configured = data?.configured ?? false;
  const root = data?.root ?? null;
  const [activeTab, setActiveTab] = useState<CompartmentTab>("hierarchy");

  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden ${PAGE_HEIGHT_CLASS}`}>
      <div className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600">
              <Network className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Compartment tree</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500">
                {data?.tenancyName ? <span>Tenancy: {data.tenancyName}</span> : null}
                {data?.totalPolicies != null ? (
                  <span>{data.totalPolicies.toLocaleString()} total policies</span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Refresh compartment tree"
          >
            <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {!configured && !isLoading && (
        <div className="flex shrink-0 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Sign in to load compartment data from KeyForge.</p>
        </div>
      )}

      {!isLoading && !isError && !root ? (
        <p className="shrink-0 text-sm text-gray-500">
          No compartment hierarchy returned by the API.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
        <div
          role="tablist"
          aria-label="Compartment views"
          className="flex shrink-0 gap-2 border-b border-blue-100 bg-blue-50/80 px-4 py-3"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`compartment-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`compartment-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  selected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 bg-white p-3">
          {activeTab === "hierarchy" ? (
            <div
              role="tabpanel"
              id="compartment-panel-hierarchy"
              aria-labelledby="compartment-tab-hierarchy"
              className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <CompartmentGraphView
                root={root}
                isLoading={isLoading}
                isError={isError}
                error={error}
              />
            </div>
          ) : (
            <div
              role="tabpanel"
              id="compartment-panel-paths"
              aria-labelledby="compartment-tab-paths"
              className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <CompartmentPathsView root={!isLoading && !isError ? root : null} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
