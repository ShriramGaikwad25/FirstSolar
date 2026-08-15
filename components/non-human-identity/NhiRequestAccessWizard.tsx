"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, ChevronLeft, ChevronRight, ShoppingCart, Plus, Trash2, Search } from "lucide-react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import HorizontalTabs from "@/components/HorizontalTabs";
import UserSearchTab from "@/app/access-request/UserSearchTab";
import { useSelectedUsers } from "@/contexts/SelectedUsersContext";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import { executeQuery } from "@/lib/api";
import { extractResultRows } from "@/lib/nhi-dashboard";

const NHI_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

const NHI_ACTIVE_QUERY = `SELECT i.nhi_id, i.name, i.nhi_type, i.state, i.risk_level,
                i.criticality, i.load_source,
                COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.username) AS owner_name,
                ai.instancename AS associated_system,
                COALESCE(NULLIF(TRIM(i.customattributes->>'environment'), ''), '') AS environment_label
           FROM public.kf_nhi_identity i
           LEFT JOIN public.usr u ON u.userid = i.ownerid
           LEFT JOIN public.applicationinstance ai ON ai.instanceid = i.instanceid
          WHERE i.tenant_id = ?::uuid
            AND lower(trim(COALESCE(i.state, ''))) = 'active'
          ORDER BY i.name
          LIMIT 500`;

export type NhiCartRow = {
  nhi_id: string;
  name: string;
  nhi_type: string;
  state: string;
  risk_level: string;
  criticality: string;
  load_source: string;
  owner_name: string;
  associated_system: string;
  environment_label: string;
};

function safeText(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function formatUsDate(iso: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function DualToggle({
  leftLabel,
  rightLabel,
  isRight,
  onLeft,
  onRight,
  ariaLabel,
}: {
  leftLabel: string;
  rightLabel: string;
  isRight: boolean;
  onLeft: () => void;
  onRight: () => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex h-10 w-full min-w-0 items-center rounded-md border border-gray-200 bg-white px-2 shadow-sm sm:px-3">
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3">
        <button
          type="button"
          onClick={onLeft}
          className={`justify-self-end text-right text-sm font-medium leading-tight ${
            !isRight ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-800"
          }`}
        >
          {leftLabel}
        </button>
        <label className="relative mx-auto inline-block h-7 w-14 shrink-0 cursor-pointer self-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={isRight}
            onChange={(e) => (e.target.checked ? onRight() : onLeft())}
            aria-label={ariaLabel}
          />
          <div className="absolute h-full w-full rounded-full bg-gray-300 transition-all peer-checked:bg-blue-600" />
          <div className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-7" />
        </label>
        <button
          type="button"
          onClick={onRight}
          className={`justify-self-start text-left text-sm font-medium leading-tight ${
            isRight ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-800"
          }`}
        >
          {rightLabel}
        </button>
      </div>
    </div>
  );
}

function parseRow(r: Record<string, unknown>): NhiCartRow {
  return {
    nhi_id: safeText(r.nhi_id),
    name: safeText(r.name),
    nhi_type: safeText(r.nhi_type),
    state: safeText(r.state),
    risk_level: safeText(r.risk_level),
    criticality: safeText(r.criticality),
    load_source: safeText(r.load_source),
    owner_name: safeText(r.owner_name),
    associated_system: safeText(r.associated_system),
    environment_label: safeText(r.environment_label),
  };
}

const steps = [
  { id: 1, title: "Select beneficiary" },
  { id: 2, title: "Select NHIs" },
  { id: 3, title: "Add details" },
  { id: 4, title: "Review and submit" },
];

export function NhiRequestAccessWizard() {
  const { selectedUsers } = useSelectedUsers();
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();

  const [requestFor, setRequestFor] = useState<"self" | "others">("self");
  const [activeUserTab, setActiveUserTab] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [rows, setRows] = useState<NhiCartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<NhiCartRow[]>([]);

  const [requestType, setRequestType] = useState<"Regular" | "Emergency">("Regular");
  const [accessType, setAccessType] = useState<"indefinite" | "duration">("duration");
  const [comments, setComments] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const step3DatesInitRef = useRef(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const loadNhis = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await executeQuery<unknown>(NHI_ACTIVE_QUERY, [NHI_TENANT_ID]);
      const resultRows = extractResultRows(response);
      setRows(resultRows.map((r) => parseRow(r as Record<string, unknown>)));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load NHIs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNhis();
  }, [loadNhis]);

  useEffect(() => {
    if (currentStep !== 3 || accessType !== "duration") return;
    if (step3DatesInitRef.current) return;
    if (startDate && endDate) {
      step3DatesInitRef.current = true;
      return;
    }
    const t = new Date();
    const end = new Date(t);
    end.setFullYear(end.getFullYear() + 1);
    if (!startDate) setStartDate(t.toISOString().slice(0, 10));
    if (!endDate) setEndDate(end.toISOString().slice(0, 10));
    step3DatesInitRef.current = true;
  }, [currentStep, accessType, startDate, endDate]);

  const userTabs = [{ label: "User Search", component: UserSearchTab }];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [
        r.name,
        r.nhi_id,
        r.nhi_type,
        r.environment_label,
        r.associated_system,
        r.owner_name,
        r.risk_level,
        r.state,
        r.criticality,
        r.load_source,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const addToCart = (r: NhiCartRow) => {
    setCart((prev) => {
      if (prev.some((x) => x.nhi_id === r.nhi_id)) return prev;
      return [...prev, r];
    });
  };

  const removeFromCart = (nhiId: string) => {
    setCart((prev) => prev.filter((x) => x.nhi_id !== nhiId));
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        cellClass: "truncate font-medium",
      },
      { headerName: "Type", field: "nhi_type" },
      { headerName: "State", field: "state" },
      { headerName: "Risk", field: "risk_level" },
      { headerName: "Criticality", field: "criticality" },
      { headerName: "Source", field: "load_source" },
      {
        headerName: "Associated app",
        field: "associated_system",
        tooltipField: "associated_system",
        cellRenderer: (params: ICellRendererParams<NhiCartRow>) => (
          <span className="block truncate" title={params.data?.associated_system}>
            {params.data?.associated_system}
          </span>
        ),
      },
      {
        headerName: "Action",
        sortable: false,
        filter: false,
        flex: 0,
        width: 64,
        cellRenderer: (params: ICellRendererParams<NhiCartRow>) => {
          const r = params.data as NhiCartRow;
          const inCart = cart.some((c) => c.nhi_id === r.nhi_id);
          return inCart ? (
            <button
              type="button"
              onClick={() => removeFromCart(r.nhi_id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
              title="Remove from cart"
              aria-label="Remove from cart"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => addToCart(r)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
              title="Add to cart"
              aria-label="Add to cart"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          );
        },
      },
    ],
    [cart]
  );

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: false,
      flex: 1,
      minWidth: 100, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, }), []);

  const canGoNext = () => {
    if (currentStep === 1) {
      if (requestFor === "others" && selectedUsers.length === 0) return false;
      return true;
    }
    if (currentStep === 2) return cart.length > 0;
    return true;
  };

  const handleNext = () => {
    if (currentStep < steps.length && canGoNext()) setCurrentStep((s) => s + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleSubmit = () => {
    const ref = `NHI-BG-${Date.now().toString(36).toUpperCase()}`;
    setSubmittedRef(ref);
    setShowSuccess(true);
  };

  return (
    <div className="w-full pt-16 min-h-screen bg-slate-50/80">
      <div
        className="fixed top-16 right-0 z-20 bg-white shadow-sm border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-3.5"
        style={{ left: isSidebarVisible ? sidebarWidthPx : 0 }}
      >
        <div className="flex items-center gap-2 sm:gap-8 min-w-0">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`flex items-center px-2 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium shrink-0 ${
              currentStep === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2.5" />
            Previous
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="flex items-center justify-center gap-0.5 sm:gap-1 min-w-0 w-full flex-wrap">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center min-w-0 flex-1 sm:flex-initial">
                  <div
                    className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium shrink-0 ${
                      currentStep >= step.id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {currentStep > step.id ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : step.id}
                  </div>
                  <div className="ml-1.5 sm:ml-3 min-w-0 overflow-hidden flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={step.title}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 sm:flex-initial w-2 sm:w-10 md:w-16 h-0.5 bg-gray-200 mx-0.5 sm:mx-3 shrink-0 max-w-2 sm:max-w-none" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1 sm:gap-4 shrink-0">
            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext()}
                className="flex items-center px-2 sm:px-5 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-2.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center px-2 sm:px-5 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm font-medium"
              >
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2.5" />
                Submit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {currentStep === 1 && (
          <>
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-4 mb-6 shadow-sm">
              <div className="mx-auto max-w-md">
                <div className="flex h-10 items-center rounded-md border border-gray-200 bg-white px-2 shadow-sm sm:px-3">
                  <div className="grid w-full grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3">
                    <button
                      type="button"
                      onClick={() => setRequestFor("self")}
                      className={`justify-self-end text-right text-sm font-medium leading-tight ${
                        requestFor === "self" ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Request for self
                    </button>
                    <label className="relative mx-auto inline-block h-7 w-14 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={requestFor === "others"}
                        onChange={(e) => setRequestFor(e.target.checked ? "others" : "self")}
                        aria-label="Request for self or others"
                      />
                      <div className="absolute h-full w-full rounded-full bg-gray-300 transition-all peer-checked:bg-blue-600" />
                      <div className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all peer-checked:translate-x-7" />
                    </label>
                    <button
                      type="button"
                      onClick={() => setRequestFor("others")}
                      className={`justify-self-start text-left text-sm font-medium leading-tight ${
                        requestFor === "others" ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Request for others
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {requestFor === "others" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <HorizontalTabs tabs={userTabs} activeIndex={activeUserTab} onChange={setActiveUserTab} />
              </div>
            )}
            {requestFor === "others" && selectedUsers.length === 0 && (
              <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-3 px-4">
                Search and select at least one user to continue.
              </p>
            )}
          </>
        )}

        {currentStep === 2 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Active NHIs ({filtered.length})
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Only identities in <strong>Active</strong> state. Add NHIs to your request cart.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                  <ShoppingCart className="h-4 w-4" aria-hidden />
                  <span>Cart: {cart.length}</span>
                </div>
              </div>
            </div>

            {(loading || error) && (
              <div className="px-4 py-2 flex items-center gap-2 text-sm">
                {loading && <span className="text-slate-500">Loading…</span>}
                {error && <span className="text-red-600">{error}</span>}
              </div>
            )}

            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search NHIs…"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <div
            className="ag-theme-alpine nhi-compact-grid"
            style={{ ["--ag-font-size" ]: "12px", ["--ag-header-font-size" ]: "12px" } as any}
          >
              <AgGridReact
                rowData={filtered}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                pagination={true}
                paginationPageSize={25}
                paginationPageSizeSelector={[10, 25, 50, 100]}
                domLayout="autoHeight"
                rowHeight={36}
                headerHeight={32}
              />
            </div>

            {cart.length > 0 && (
              <div className="border-t border-gray-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">In cart ({cart.length})</p>
                <ul className="flex flex-wrap gap-2">
                  {cart.map((c) => (
                    <li
                      key={c.nhi_id}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      <span className="max-w-[160px] truncate">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(c.nhi_id)}
                        className="text-red-600 hover:text-red-800"
                        aria-label={`Remove ${c.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="rounded-xl border border-slate-200/90 bg-[#f0f5ff] p-5 shadow-sm sm:p-6">
            <h2 className="mb-5 text-base font-semibold text-slate-900">Access Duration &amp; Comments</h2>

            <div
              className={`mb-6 grid grid-cols-1 gap-x-4 gap-y-5 lg:items-start ${
                accessType === "duration" ? "lg:grid-cols-4" : "lg:grid-cols-2"
              }`}
            >
              <div className="flex min-w-0 flex-col gap-2">
                <span className="min-h-[1.25rem] text-sm font-medium leading-none text-slate-700">
                  Access Type
                </span>
                <DualToggle
                  leftLabel="Indefinite"
                  rightLabel="Duration"
                  isRight={accessType === "duration"}
                  onLeft={() => {
                    setAccessType("indefinite");
                    setStartDate("");
                    setEndDate("");
                  }}
                  onRight={() => {
                    setAccessType("duration");
                    const t = new Date();
                    const end = new Date(t);
                    end.setFullYear(end.getFullYear() + 1);
                    setStartDate((s) => s || t.toISOString().slice(0, 10));
                    setEndDate((e) => e || end.toISOString().slice(0, 10));
                  }}
                  ariaLabel="Access type: Indefinite or Duration"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <span className="min-h-[1.25rem] text-sm font-medium leading-none text-slate-700">
                  Request Type
                </span>
                <DualToggle
                  leftLabel="Regular"
                  rightLabel="Emergency"
                  isRight={requestType === "Emergency"}
                  onLeft={() => setRequestType("Regular")}
                  onRight={() => setRequestType("Emergency")}
                  ariaLabel="Request type: Regular or Emergency"
                />
              </div>

              {accessType === "duration" && (
                <>
                  <div className="flex min-w-0 flex-col gap-2">
                    <label
                      className="min-h-[1.25rem] text-sm font-medium leading-none text-slate-700"
                      htmlFor="nhi-start-date"
                    >
                      Start Date
                    </label>
                    <div className="relative h-10">
                      <Calendar
                        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        aria-hidden
                      />
                      <input
                        id="nhi-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-10 w-full rounded-md border border-gray-200 bg-white py-0 pl-9 pr-9 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      />
                      <Calendar
                        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        aria-hidden
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <label
                      className="min-h-[1.25rem] text-sm font-medium leading-none text-slate-700"
                      htmlFor="nhi-end-date"
                    >
                      End Date
                    </label>
                    <div className="relative h-10">
                      <Calendar
                        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        aria-hidden
                      />
                      <input
                        id="nhi-end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-10 w-full rounded-md border border-gray-200 bg-white py-0 pl-9 pr-9 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      />
                      <Calendar
                        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        aria-hidden
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="nhi-comments">
                Comments
              </label>
              <textarea
                id="nhi-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="Enter comments that will apply to all access items..."
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">Access &amp; request</p>
              <p className="text-sm text-blue-800">
                Access type: {accessType === "duration" ? "Duration" : "Indefinite"} · Request type:{" "}
                {requestType}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Beneficiary</p>
              {requestFor === "self" ? (
                <p className="text-sm text-gray-700">Request for self</p>
              ) : (
                <ul className="space-y-2">
                  {selectedUsers.map((u) => (
                    <li key={u.id} className="text-sm text-gray-700">
                      {u.name} <span className="text-gray-500">({u.username})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">NHIs ({cart.length})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b text-slate-600">
                      <th className="py-2 pr-2">Name</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Risk</th>
                      <th className="py-2 pr-2">Associated app</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((c) => (
                      <tr key={c.nhi_id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 font-medium">{c.name}</td>
                        <td className="py-2 pr-2">{c.nhi_type}</td>
                        <td className="py-2 pr-2">{c.risk_level}</td>
                        <td className="py-2 pr-2">{c.associated_system}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Comments</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {comments.trim() ? comments : "—"}
              </p>
              {accessType === "duration" && (startDate || endDate) && (
                <p className="mt-3 text-xs text-gray-600">
                  Period: {formatUsDate(startDate)} → {formatUsDate(endDate)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showSuccess && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Request submitted</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your NHI access / breakglass request reference:
            </p>
            <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-mono text-lg font-semibold text-blue-900">
              {submittedRef}
            </p>
            <p className="mt-3 text-xs text-gray-500">
              This is a UI placeholder until the workflow API is connected.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSuccess(false);
                setCurrentStep(1);
                setCart([]);
                setComments("");
                setRequestType("Regular");
                setAccessType("duration");
                setStartDate("");
                setEndDate("");
                step3DatesInitRef.current = false;
              }}
              className="mt-6 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Start new request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
