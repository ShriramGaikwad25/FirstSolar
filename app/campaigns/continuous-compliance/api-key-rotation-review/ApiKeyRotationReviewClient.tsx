"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, KeyRound } from "lucide-react";

const DEFAULT_KEY_ID = "AK-982734";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase text-gray-500 font-medium tracking-wide">{children}</div>
  );
}

function FieldValue({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm text-gray-900 mt-1 break-words ${className}`.trim()}>{children}</div>;
}

const AUDIT_EVENTS: { title: string; detail: string; danger?: boolean }[] = [
  {
    title: "Apr 10, 2026 — Alert generated",
    detail:
      "Continuous compliance engine detected API key age exceeded 90-day policy threshold.",
  },
  {
    title: "Apr 11, 2026 — Owner notified",
    detail: "Notification sent to Finance Team and DevOps Team.",
  },
  {
    title: "Apr 15, 2026 — Reminder sent",
    detail: "No remediation action recorded after 5 days.",
  },
  {
    title: "Apr 23, 2026 — No action taken",
    detail: "Violation remains open and is approaching SLA breach.",
    danger: true,
  },
];

export default function ApiKeyRotationReviewClient() {
  const searchParams = useSearchParams();
  const keyId = (searchParams.get("keyId") || DEFAULT_KEY_ID).trim() || DEFAULT_KEY_ID;

  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8 pb-10 space-y-5">
        {/* Top status card — neutral base, minimal accent color */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="relative border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white px-5 py-5 md:px-6 md:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4 min-w-0">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
                  aria-hidden
                >
                  <KeyRound className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Violation
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                    API Key Overdue for Rotation
                  </h1>
                </div>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-rose-200/90 bg-rose-50/80 px-3 py-1.5 text-[11px] font-bold tracking-wide text-rose-800 sm:mt-0">
                NON-COMPLIANT
              </span>
            </div>
          </div>

          <div className="bg-white px-4 py-4 md:px-6 md:py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-slate-50/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Key ID</p>
                <p className="mt-1 font-mono text-sm font-semibold text-gray-900 tabular-nums break-all">
                  {keyId}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">Key age</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-amber-900">187 days</p>
                <p className="text-xs text-amber-800/80 mt-0.5">Exceeds policy window</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rotation policy</p>
                <p className="mt-1 text-base font-semibold text-gray-900">Every 90 days</p>
                <p className="text-xs text-gray-500 mt-0.5">Required cadence</p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-amber-950">
              <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-950">SLA breach in 2 days</p>
                <p className="text-xs text-amber-900/75 mt-0.5">
                  Remediate or document an exception before the compliance deadline.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left column */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Identity</h2>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Identity Type</FieldLabel>
                  <FieldValue>Application</FieldValue>
                </div>
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <FieldValue>Billing-Service</FieldValue>
                </div>
                <div>
                  <FieldLabel>Environment</FieldLabel>
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-xs font-semibold">
                      Production
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Ownership</h2>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Business Owner</FieldLabel>
                  <div className="mt-1.5 flex items-center gap-2.5 text-sm font-medium text-gray-900">
                    <span className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold inline-flex items-center justify-center">
                      FT
                    </span>
                    Finance Team
                  </div>
                </div>
                <div>
                  <FieldLabel>Technical Owner</FieldLabel>
                  <div className="mt-1.5 flex items-center gap-2.5 text-sm font-medium text-gray-900">
                    <span className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold inline-flex items-center justify-center">
                      DO
                    </span>
                    DevOps Team
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Associations</h2>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Service Account</FieldLabel>
                  <FieldValue>
                    <Link href="/service-account" className="text-blue-600 font-medium hover:underline">
                      svc-billing-prod
                    </Link>
                  </FieldValue>
                </div>
                <div>
                  <FieldLabel>Linked App</FieldLabel>
                  <FieldValue>
                    <Link href="/applications" className="text-blue-600 font-medium hover:underline">
                      Billing API Gateway
                    </Link>
                  </FieldValue>
                </div>
              </div>
            </div>
          </aside>

          {/* Main column */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Violation Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Policy Violated</FieldLabel>
                  <FieldValue>API Key Rotation</FieldValue>
                </div>
                <div>
                  <FieldLabel>Required Rotation</FieldLabel>
                  <FieldValue>Every 90 days</FieldValue>
                </div>
                <div>
                  <FieldLabel>Last Rotated</FieldLabel>
                  <FieldValue>Jan 12, 2026</FieldValue>
                </div>
                <div>
                  <FieldLabel>Overdue By</FieldLabel>
                  <FieldValue className="text-red-600 font-semibold">97 days</FieldValue>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Risk Context</h2>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-semibold">
                  Production
                </span>
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-semibold">
                  High Privilege
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-xs font-semibold">
                  External Exposure: Yes
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Remediation Actions</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  Rotate API Key
                </button>
                <button
                  type="button"
                  className="h-9 px-4 rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
                >
                  Mark as Exception
                </button>
                <button
                  type="button"
                  className="h-9 px-4 rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
                >
                  Decommission Key
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Identity: Billing-Service · Credential: API Key (
                <code className="font-mono text-gray-700">{keyId}</code>)
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Exception Workflow</h2>
              <div className="space-y-4 pt-1 border-t border-gray-100 -mt-1">
                <div>
                  <label className="text-xs uppercase text-gray-500 font-medium" htmlFor="cc-api-key-justification">
                    Justification
                  </label>
                  <textarea
                    id="cc-api-key-justification"
                    rows={3}
                    placeholder="Provide a business or technical reason for requesting an exception..."
                    className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-medium" htmlFor="cc-api-key-expiry">
                      Expiry Date
                    </label>
                    <input
                      id="cc-api-key-expiry"
                      type="date"
                      defaultValue="2026-05-30"
                      className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-medium" htmlFor="cc-api-key-approver">
                      Approver
                    </label>
                    <select
                      id="cc-api-key-approver"
                      className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                      defaultValue="Security Governance Lead"
                    >
                      <option>Security Governance Lead</option>
                      <option>Application Owner</option>
                      <option>Platform Engineering Manager</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-9 px-4 rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
                >
                  Submit Exception
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Audit Trail</h2>
              <ul className="relative pl-0 space-y-0 border-l-2 border-gray-200 ml-1.5">
                {AUDIT_EVENTS.map((ev) => (
                  <li key={ev.title} className="relative pl-6 pb-5 last:pb-0">
                    <span
                      className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${
                        ev.danger ? "bg-red-600" : "bg-gray-400"
                      }`}
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-gray-900">{ev.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{ev.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
