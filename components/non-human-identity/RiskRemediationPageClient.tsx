"use client";

import { useState } from "react";
import {
  FindingsPage,
  FINDINGS_STATUS_OPTIONS,
  type FindingsStatusFilter,
} from "@/components/non-human-identity/FindingsPage";
import { SodViolationsPage } from "@/components/non-human-identity/SodViolationsPage";

type Tab = "findings" | "sod";

export function RiskRemediationPageClient() {
  const [tab, setTab] = useState<Tab>("findings");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [findingStatus, setFindingStatus] = useState<FindingsStatusFilter>("open");

  return (
    <div className="w-full space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Risk &amp; Remediation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review open findings and segregation-of-duty violations for non-human identities in one place.
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-blue-200 bg-blue-50/80 p-1">
          <button
            type="button"
            onClick={() => setTab("findings")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "findings"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-blue-900/75 hover:bg-blue-100 hover:text-blue-950"
            }`}
          >
            Findings
          </button>
          <button
            type="button"
            onClick={() => setTab("sod")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "sod"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-blue-900/75 hover:bg-blue-100 hover:text-blue-950"
            }`}
          >
            SOD
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {tab === "findings" && (
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={findingStatus}
              onChange={(e) => setFindingStatus(e.target.value as FindingsStatusFilter)}
              aria-label="Finding status filter"
            >
              {FINDINGS_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setRefreshNonce((n) => n + 1)}
            title="Refresh"
            aria-label="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {tab === "findings" && (
        <FindingsPage
          suppressPageHeader
          refreshNonce={refreshNonce}
          statusFilter={findingStatus}
          onStatusFilterChange={setFindingStatus}
        />
      )}
      {tab === "sod" && <SodViolationsPage suppressPageHeader refreshNonce={refreshNonce} />}
    </div>
  );
}
