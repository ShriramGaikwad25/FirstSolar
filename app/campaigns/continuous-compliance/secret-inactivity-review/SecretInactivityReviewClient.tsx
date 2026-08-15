"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Lock } from "lucide-react";

const DEFAULT_SECRET_ID = "SEC-449821";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase text-gray-500 font-medium tracking-wide">{children}</div>
  );
}

function FieldValue({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm text-gray-900 mt-1 break-words ${className}`.trim()}>{children}</div>;
}

const AUDIT_EVENTS: { title: string; detail: string; warning?: boolean }[] = [
  {
    title: "Apr 3, 2026 — Inactivity threshold reached",
    detail: "Secret crossed the 120-day inactivity review threshold.",
  },
  {
    title: "Apr 5, 2026 — Owner notified",
    detail: "Notifications sent to Payments Team and Platform Engineering.",
  },
  {
    title: "Apr 12, 2026 — Dependency scan completed",
    detail: "No recent runtime references detected in monitored workloads.",
  },
  {
    title: "Apr 23, 2026 — Secret remains active",
    detail: "No decommission or exception action recorded.",
    warning: true,
  },
];

const CHECKLIST_STEPS = [
  {
    step: "Step 1",
    text: "Confirm whether the workload still requires this secret.",
  },
  {
    step: "Step 2",
    text: "Check dependent applications, pipelines, and scheduled jobs for references.",
  },
  {
    step: "Step 3",
    text: "If not required, revoke and decommission the secret in the source vault.",
  },
  {
    step: "Step 4",
    text: "If still required, record justification and reset inactivity monitoring.",
  },
];

export default function SecretInactivityReviewClient() {
  const searchParams = useSearchParams();
  const secretId =
    (searchParams.get("secretId") || DEFAULT_SECRET_ID).trim() || DEFAULT_SECRET_ID;

  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8 pb-10 space-y-5">
        {/* Top status card — warning / at risk */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="relative border-b border-gray-100 bg-gradient-to-b from-amber-50/80 to-white px-5 py-5 md:px-6 md:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4 min-w-0">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-200/80"
                  aria-hidden
                >
                  <Lock className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-900/80">
                    Violation
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                    Secret Not Used for Over 120 Days
                  </h1>
                </div>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-amber-300/90 bg-amber-100/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-amber-950 sm:mt-0">
                AT RISK
              </span>
            </div>
          </div>

          <div className="bg-white px-4 py-4 md:px-6 md:py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-slate-50/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Secret ID</p>
                <p className="mt-1 font-mono text-sm font-semibold text-gray-900 tabular-nums break-all">
                  {secretId}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">Unused</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-amber-950">143 days</p>
                <p className="text-xs text-amber-900/75 mt-0.5">Beyond inactivity policy</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Policy</p>
                <p className="mt-1 text-base font-semibold text-gray-900">Max inactivity 120 days</p>
                <p className="text-xs text-gray-500 mt-0.5">Review threshold</p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-amber-950">
              <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-950">Review overdue in 3 days</p>
                <p className="text-xs text-amber-900/75 mt-0.5">
                  Complete review, decommission, or file an exception before the compliance window closes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
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
                  <FieldValue>Payments-Worker</FieldValue>
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
                      PM
                    </span>
                    Payments Team
                  </div>
                </div>
                <div>
                  <FieldLabel>Technical Owner</FieldLabel>
                  <div className="mt-1.5 flex items-center gap-2.5 text-sm font-medium text-gray-900">
                    <span className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold inline-flex items-center justify-center">
                      PE
                    </span>
                    Platform Engineering
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Associations</h2>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Secret Store</FieldLabel>
                  <FieldValue>
                    <Link href="/settings/gateway" className="text-blue-600 font-medium hover:underline">
                      Vault / kv-prod/payments
                    </Link>
                  </FieldValue>
                </div>
                <div>
                  <FieldLabel>Linked Workload</FieldLabel>
                  <FieldValue>
                    <Link href="/applications" className="text-blue-600 font-medium hover:underline">
                      payments-worker-prod
                    </Link>
                  </FieldValue>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Violation Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Policy Violated</FieldLabel>
                  <FieldValue>Secret Inactivity Review</FieldValue>
                </div>
                <div>
                  <FieldLabel>Allowed Inactivity</FieldLabel>
                  <FieldValue>Up to 120 days</FieldValue>
                </div>
                <div>
                  <FieldLabel>Last Accessed</FieldLabel>
                  <FieldValue>Dec 1, 2025</FieldValue>
                </div>
                <div>
                  <FieldLabel>Exceeded By</FieldLabel>
                  <FieldValue className="text-amber-800 font-semibold">23 days</FieldValue>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Risk Context</h2>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-semibold">
                  Production
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-xs font-semibold">
                  Medium Risk
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100/90 text-amber-900 px-2.5 py-1 text-xs font-semibold">
                  Unused Credential
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-1 text-xs font-semibold">
                  No Recent Access
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
                  Review and Decommission Secret
                </button>
                <button
                  type="button"
                  className="h-9 px-4 rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
                >
                  Mark as Still Required
                </button>
                <button
                  type="button"
                  className="h-9 px-4 rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
                >
                  Open Exception
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Identity: Payments-Worker · Credential: Secret (
                <code className="font-mono text-gray-700">{secretId}</code>)
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Validation Checklist</h2>
              <div className="space-y-3">
                {CHECKLIST_STEPS.map((row) => (
                  <div key={row.step} className="rounded-lg border border-gray-200 bg-slate-50/40 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {row.step}
                    </p>
                    <p className="text-sm text-gray-900 mt-1">{row.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Exception Workflow</h2>
              <div className="space-y-4 pt-1 border-t border-gray-100 -mt-1">
                <div>
                  <label
                    className="text-xs uppercase text-gray-500 font-medium"
                    htmlFor="cc-secret-justification"
                  >
                    Justification
                  </label>
                  <textarea
                    id="cc-secret-justification"
                    rows={3}
                    placeholder="Explain why the secret should remain active despite no usage in the last 120 days..."
                    className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-medium" htmlFor="cc-secret-review">
                      Review Date
                    </label>
                    <input
                      id="cc-secret-review"
                      type="date"
                      defaultValue="2026-05-15"
                      className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-medium" htmlFor="cc-secret-approver">
                      Approver
                    </label>
                    <select
                      id="cc-secret-approver"
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
                        ev.warning ? "bg-amber-500" : "bg-gray-400"
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
