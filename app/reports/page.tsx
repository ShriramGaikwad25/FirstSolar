"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Proxied via API route to avoid CORS (browser -> same-origin API -> external API)
const GET_ALL_SIGNATURE_URL = "/api/reports/getallsignature";

export default function ReportsPage() {
  const router = useRouter();
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [reportTypeSearch, setReportTypeSearch] = useState<string>("");
  const [isReportTypeDropdownOpen, setIsReportTypeDropdownOpen] = useState(false);
  const reportTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Reports from getallsignature API: { reportName, viewName }[]
  const [reports, setReports] = useState<{ reportName: string; viewName: string }[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  // Filter reports based on search
  const filteredReports = reports.filter(
    (r) =>
      r.reportName.toLowerCase().includes(reportTypeSearch.toLowerCase()) ||
      r.viewName.toLowerCase().includes(reportTypeSearch.toLowerCase())
  );

  // Fetch getallsignature API on mount
  useEffect(() => {
    let cancelled = false;
    setSignatureLoading(true);
    setSignatureError(null);
    fetch(GET_ALL_SIGNATURE_URL, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const obj = data && typeof data === "object" && data !== null ? (data as { signatures?: unknown }) : null;
        const sigs = Array.isArray(obj?.signatures) ? obj.signatures : [];
        const list = sigs
          .filter((s: unknown) => s && typeof s === "object" && "reportName" in (s as object))
          .map((s: { reportName: string; viewName?: string }) => ({
            reportName: String((s as { reportName: unknown }).reportName),
            viewName: String((s as { viewName?: unknown }).viewName ?? ""),
          }));
        setReports(list);
      })
      .catch((err) => {
        if (!cancelled) setSignatureError(err?.message || "Failed to load signatures");
        setReports([]);
      })
      .finally(() => {
        if (!cancelled) setSignatureLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reportTypeDropdownRef.current &&
        !reportTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsReportTypeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleReportTypeSelect = (viewName: string) => {
    if (reports.some((r) => r.viewName === viewName)) {
      setSelectedReportType(viewName);
      setReportTypeSearch("");
      setIsReportTypeDropdownOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-8 px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            Reports
          </h1>
          
          <div className="space-y-6">
            <p className="text-gray-600">
              View and generate reports for your organization's identity and access management.
            </p>

            {/* Search Boxes */}
            <div className="grid grid-cols-1 gap-6 max-w-md">
              {/* Report Type Search Box */}
              <div className="relative" ref={reportTypeDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={reportTypeSearch}
                    onChange={(e) => {
                      setReportTypeSearch(e.target.value);
                      setIsReportTypeDropdownOpen(true);
                    }}
                    onFocus={() => setIsReportTypeDropdownOpen(true)}
                    placeholder=" "
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline pr-10"
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    reportTypeSearch || isReportTypeDropdownOpen
                      ? 'top-0.5 text-xs text-blue-600' 
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Select Report Type *
                  </label>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Report cards from getallsignature API */}
            <div className="mt-6">
              {signatureLoading && (
                <p className="text-sm text-gray-500">Loading reports…</p>
              )}
              {signatureError && (
                <p className="text-sm text-red-600">{signatureError}</p>
              )}
              {!signatureLoading && !signatureError && reports.length === 0 && (
                <p className="text-sm text-gray-500">No reports available.</p>
              )}
              {!signatureLoading && !signatureError && reports.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredReports.map((report) => (
                    <div
                      key={report.viewName}
                      onClick={() => handleReportTypeSelect(report.viewName)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedReportType === report.viewName
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-lg mr-3 flex-shrink-0">
                          📋
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm">{report.reportName}</h3>
                        </div>
                        {selectedReportType === report.viewName && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected report */}
            {selectedReportType && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Selected report</h3>
                <div className="text-sm text-gray-600">
                  {reports.find((r) => r.viewName === selectedReportType)?.reportName ?? selectedReportType}
                </div>
              </div>
            )}

            {/* Next Button */}
            {selectedReportType && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    const reportName = reports.find((r) => r.viewName === selectedReportType)?.reportName ?? selectedReportType;
                    router.push(`/reports/filter?reportType=${encodeURIComponent(reportName)}`);
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
