"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, ChevronDown, Info, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useOciPolicyImpactSummary } from "@/hooks/useOciPolicyImpactSummary";

type ImpactSubTab = "summary" | "principals" | "resources" | "graph" | "findings";

const SUB_TABS: { id: ImpactSubTab; label: string }[] = [
  { id: "summary", label: "Impact Summary" },
  { id: "principals", label: "Principal Impact" },
  { id: "resources", label: "Resource Impact" },
  { id: "graph", label: "Effective Access Graph" },
  { id: "findings", label: "Risk & Findings" },
];

type PillTone = "red" | "orange" | "purple" | "blue" | "green" | "gray";

const PILL_TONE_CLASS: Record<PillTone, string> = {
  red: "bg-red-100 text-red-700",
  orange: "bg-amber-100 text-amber-700",
  purple: "bg-purple-100 text-purple-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  gray: "bg-gray-100 text-gray-600",
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

function Bar({ label, value, max, count }: { label: string; value: number; max: number; count: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="my-2.5 grid grid-cols-[130px_1fr_36px] items-center gap-2.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
      <b className="text-right text-gray-900">{count}</b>
    </div>
  );
}

interface PrincipalRow {
  id: string;
  name: string;
  type: string;
  current: string;
  proposed: string;
  change: "Expanded" | "New access" | "Removed" | "No effective change";
  resources: string;
  scope: string;
  risk: "Critical" | "High" | "Medium" | "Low";
  detail?: { label: string; value: string }[];
}

const PRINCIPALS: PrincipalRow[] = [
  {
    id: "p1",
    name: "FinanceAdmins",
    type: "User group",
    current: "Inspect instances",
    proposed: "Manage all-resources",
    change: "Expanded",
    resources: "18 resource types",
    scope: "Compartment → tenancy",
    risk: "Critical",
    detail: [
      { label: "Permission", value: "inspect → manage" },
      { label: "Resource", value: "instances → all-resources" },
      { label: "Scope", value: "Finance compartment → tenancy" },
      { label: "Condition", value: "Tag restriction removed" },
      { label: "Overlapping policy", value: "None found" },
    ],
  },
  {
    id: "p2",
    name: "deployment-agents",
    type: "Dynamic group",
    current: "Read secret-bundles",
    proposed: "Manage secret-family",
    change: "Expanded",
    resources: "Secrets, vaults",
    scope: "Security compartment",
    risk: "High",
    detail: [
      { label: "Permission", value: "read → manage" },
      { label: "Resource", value: "secret-bundles → secret-family" },
      { label: "Scope", value: "No change" },
      { label: "Condition", value: "No change" },
      { label: "Overlapping policy", value: "1 partial overlap" },
    ],
  },
  {
    id: "p3",
    name: "objectstorage",
    type: "Service principal",
    current: "Use keys",
    proposed: "No access",
    change: "Removed",
    resources: "Keys",
    scope: "Security compartment",
    risk: "Medium",
  },
  {
    id: "p4",
    name: "Auditors",
    type: "User group",
    current: "Inspect audit-events",
    proposed: "Inspect audit-events",
    change: "No effective change",
    resources: "Audit events",
    scope: "Tenancy",
    risk: "Low",
  },
  {
    id: "p5",
    name: "SecurityAdmins",
    type: "User group",
    current: "No access",
    proposed: "Manage vaults",
    change: "New access",
    resources: "Vaults",
    scope: "Security compartment",
    risk: "High",
  },
];

const CHANGE_TONE: Record<PrincipalRow["change"], PillTone> = {
  Expanded: "red",
  "New access": "blue",
  Removed: "purple",
  "No effective change": "gray",
};

const RISK_TONE: Record<PrincipalRow["risk"], PillTone> = {
  Critical: "red",
  High: "red",
  Medium: "orange",
  Low: "green",
};

interface ResourceRow {
  id: string;
  name: string;
  sensitivity: string;
  sensitivityTone: PillTone;
  current: number;
  proposed: number;
  added: number;
  removed: number;
  permission: string;
  scope: string;
  risk: "Critical" | "High" | "Medium" | "Low";
  detail?: { principal: string; current: string; proposed: string; result: string }[];
}

const RESOURCES: ResourceRow[] = [
  {
    id: "r1",
    name: "all-resources",
    sensitivity: "Broad scope",
    sensitivityTone: "red",
    current: 1,
    proposed: 2,
    added: 1,
    removed: 0,
    permission: "inspect → manage",
    scope: "Tenancy",
    risk: "Critical",
    detail: [
      { principal: "FinanceAdmins", current: "inspect instances", proposed: "manage all-resources", result: "Major expansion" },
    ],
  },
  {
    id: "r2",
    name: "secret-family",
    sensitivity: "Security infrastructure",
    sensitivityTone: "red",
    current: 3,
    proposed: 5,
    added: 2,
    removed: 0,
    permission: "read → manage",
    scope: "Security",
    risk: "High",
  },
  {
    id: "r3",
    name: "vaults",
    sensitivity: "Security infrastructure",
    sensitivityTone: "red",
    current: 2,
    proposed: 3,
    added: 1,
    removed: 0,
    permission: "New manage access",
    scope: "Security",
    risk: "High",
  },
  {
    id: "r4",
    name: "keys",
    sensitivity: "Sensitive",
    sensitivityTone: "orange",
    current: 4,
    proposed: 3,
    added: 0,
    removed: 1,
    permission: "Use access removed",
    scope: "Security",
    risk: "Medium",
  },
  {
    id: "r5",
    name: "audit-events",
    sensitivity: "Compliance",
    sensitivityTone: "blue",
    current: 2,
    proposed: 2,
    added: 0,
    removed: 0,
    permission: "No effective change",
    scope: "Tenancy",
    risk: "Low",
  },
];

interface Finding {
  title: string;
  detail: string;
  tone: PillTone;
  badge: string;
  info?: boolean;
}

const FINDINGS: Finding[] = [
  {
    title: "Tenancy-wide manage access introduced",
    detail:
      "FinanceAdmins gains manage access to all-resources at tenancy scope. No condition restricts the new grant.",
    tone: "red",
    badge: "Critical",
  },
  {
    title: "Secret-management privilege expanded",
    detail:
      "deployment-agents moves from read secret-bundles to manage secret-family in the Security compartment.",
    tone: "red",
    badge: "High",
  },
  {
    title: "Potential service disruption",
    detail: "Object Storage loses effective use access to keys. Encryption workflows may fail after enforcement.",
    tone: "orange",
    badge: "Medium",
  },
  {
    title: "Direct removal, no effective change",
    detail:
      "Auditors loses a direct grant in this policy, but equivalent inspect access remains through AuditBaselinePolicy.",
    tone: "green",
    badge: "Informational",
    info: true,
  },
];

function ExpandButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Collapse details" : "Expand details"}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
    >
      <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

export function ImpactAnalysisPanel({
  policyName,
  policyUid,
  draftLabel = "Draft v5",
  enforcedLabel = "v4",
  analyzedOn: analyzedOnFallback = "Jul 10, 2026 · 2:24 PM",
}: {
  policyName: string;
  policyUid?: string | null;
  draftLabel?: string;
  enforcedLabel?: string;
  analyzedOn?: string;
}) {
  const [subTab, setSubTab] = useState<ImpactSubTab>("summary");
  const [expandedPrincipal, setExpandedPrincipal] = useState<string | null>(null);
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  const {
    data: impactSummary,
    isLoading: summaryLoading,
    isError: summaryIsError,
    error: summaryError,
  } = useOciPolicyImpactSummary(policyUid);

  const blastRadius = impactSummary?.blastRadius ?? "High";
  const principalsAffected = impactSummary?.principalsAffected ?? 14;
  const compartmentsAffected = impactSummary?.compartmentsAffected ?? 3;
  const resourceFamiliesAffected = impactSummary?.resourceFamiliesAffected ?? 8;
  const criticalExposures = impactSummary?.criticalExposures ?? 2;
  const privilegeExpansions = impactSummary?.privilegeExpansions ?? 4;
  const accessLosses = impactSummary?.accessLosses ?? 3;
  const permissionsAdded = impactSummary?.permissionsAdded ?? 8;
  const permissionsRemoved = impactSummary?.permissionsRemoved ?? 3;
  const overallRiskFrom = impactSummary?.overallRiskFrom ?? "Medium";
  const overallRiskTo = impactSummary?.overallRiskTo ?? "High";
  const comparedWithVersion = impactSummary?.comparedWithVersion ?? enforcedLabel;
  const analyzedOn = impactSummary?.analyzedOn ?? analyzedOnFallback;

  return (
    <div>
      {summaryIsError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {summaryError instanceof Error ? summaryError.message : "Failed to load impact summary."}
        </p>
      )}

      {/* Header strip */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Pill tone="blue">{policyName}</Pill>
            <Pill tone="gray">{draftLabel}</Pill>
            <span>Compared with enforced version {comparedWithVersion}</span>
            <span>· Analysis completed {analyzedOn}</span>
            {summaryLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" aria-hidden />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900">
                Blast radius: <span className="text-red-600">{blastRadius}</span>
              </p>
              <p className="text-xs text-gray-500">
                {principalsAffected} principals affected across {compartmentsAffected} compartments and{" "}
                {resourceFamiliesAffected} resource families.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="red">{criticalExposures} critical exposures</Pill>
              <Pill tone="orange">{privilegeExpansions} privilege expansions</Pill>
              <Pill tone="purple">{accessLosses} effective access losses</Pill>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Export analysis
          </button>
          <button type="button" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Run again
          </button>
          <button type="button" className="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Submit for approval
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              subTab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SUMMARY ── */}
      {subTab === "summary" && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Principals affected", value: String(principalsAffected), cls: "text-gray-900" },
              { label: "Permissions added", value: String(permissionsAdded), cls: "text-gray-900" },
              { label: "Permissions removed", value: String(permissionsRemoved), cls: "text-gray-900" },
              { label: "Resource families affected", value: String(resourceFamiliesAffected), cls: "text-gray-900" },
              { label: "Compartments affected", value: String(compartmentsAffected), cls: "text-gray-900" },
              { label: "Overall risk", value: `${overallRiskFrom} → ${overallRiskTo}`, cls: "text-red-600" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-gray-200 p-3">
                <div className={`text-lg font-bold ${m.cls}`}>{m.value}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <b>Direct and effective impact differ.</b> Removing a grant from this policy does not always remove
              access. Equivalent access from other policies is considered before classifying the effective result.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-sm font-bold text-gray-800">
                Impact by principal type
              </div>
              <div className="p-3.5">
                <Bar label="User groups" value={86} max={100} count={6} />
                <Bar label="Dynamic groups" value={58} max={100} count={4} />
                <Bar label="Resource principals" value={42} max={100} count={3} />
                <Bar label="Services" value={16} max={100} count={1} />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-sm font-bold text-gray-800">
                Impact by change type
              </div>
              <div className="p-3.5">
                <Bar label="Privilege expanded" value={82} max={100} count={9} />
                <Bar label="New access" value={62} max={100} count={7} />
                <Bar label="Access removed" value={34} max={100} count={3} />
                <Bar label="No effective change" value={24} max={100} count={2} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-sm font-bold text-gray-800">
                Highest-impact principals
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Principal", "Type", "Effective change", "Risk"].map((h) => (
                      <th key={h} className="border-b border-gray-200 bg-blue-50/60 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-900">FinanceAdmins</td>
                    <td className="px-3 py-2.5 text-gray-600">User group</td>
                    <td className="px-3 py-2.5 text-gray-600">Manage all-resources at tenancy scope</td>
                    <td className="px-3 py-2.5"><Pill tone="red">Critical</Pill></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-900">deployment-agents</td>
                    <td className="px-3 py-2.5 text-gray-600">Dynamic group</td>
                    <td className="px-3 py-2.5 text-gray-600">Read → manage secret-family</td>
                    <td className="px-3 py-2.5"><Pill tone="red">High</Pill></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-medium text-gray-900">objectstorage</td>
                    <td className="px-3 py-2.5 text-gray-600">Service principal</td>
                    <td className="px-3 py-2.5 text-gray-600">Key access removed</td>
                    <td className="px-3 py-2.5"><Pill tone="orange">Medium</Pill></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-sm font-bold text-gray-800">
                Most-exposed resources
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Resource", "Principal delta", "Permission delta", "Risk"].map((h) => (
                      <th key={h} className="border-b border-gray-200 bg-blue-50/60 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-900">all-resources</td>
                    <td className="px-3 py-2.5 text-gray-600">+1 principal</td>
                    <td className="px-3 py-2.5 text-gray-600">inspect → manage</td>
                    <td className="px-3 py-2.5"><Pill tone="red">Critical</Pill></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-900">secret-family</td>
                    <td className="px-3 py-2.5 text-gray-600">+2 principals</td>
                    <td className="px-3 py-2.5 text-gray-600">read → manage</td>
                    <td className="px-3 py-2.5"><Pill tone="red">High</Pill></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-medium text-gray-900">vaults</td>
                    <td className="px-3 py-2.5 text-gray-600">+1 principal</td>
                    <td className="px-3 py-2.5 text-gray-600">New manage access</td>
                    <td className="px-3 py-2.5"><Pill tone="red">High</Pill></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINCIPAL IMPACT ── */}
      {subTab === "principals" && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Principal impact</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Who gains or loses effective access, and how their resource scope changes.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Principal", "Type", "Current effective access", "Proposed effective access", "Change", "Resources", "Scope", "Risk", ""].map((h) => (
                    <th key={h} className="border-b border-gray-200 bg-blue-50/60 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRINCIPALS.map((p) => {
                  const open = expandedPrincipal === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-2.5 font-medium text-gray-900">{p.name}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.type}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.current}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.proposed}</td>
                        <td className="px-3 py-2.5"><Pill tone={CHANGE_TONE[p.change]}>{p.change}</Pill></td>
                        <td className="px-3 py-2.5 text-gray-600">{p.resources}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.scope}</td>
                        <td className="px-3 py-2.5"><Pill tone={RISK_TONE[p.risk]}>{p.risk}</Pill></td>
                        <td className="px-3 py-2.5">
                          {p.detail && (
                            <ExpandButton
                              open={open}
                              onClick={() => setExpandedPrincipal(open ? null : p.id)}
                            />
                          )}
                        </td>
                      </tr>
                      {open && p.detail && (
                        <tr key={`${p.id}-detail`} className="border-b border-gray-100 bg-slate-50">
                          <td colSpan={9} className="p-3.5">
                            <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                              <b className="text-sm text-gray-800">Effective access delta</b>
                              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                                {p.detail.map((d) => (
                                  <div key={d.label} className="rounded-md border border-gray-200 p-2.5">
                                    <small className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                      {d.label}
                                    </small>
                                    <span className="text-sm text-gray-800">{d.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RESOURCE IMPACT ── */}
      {subTab === "resources" && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Resource impact</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Which protected resources become more or less exposed after the draft is enforced.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Resource", "Sensitivity", "Current principals", "Proposed principals", "Added", "Removed", "Permission change", "Scope", "Risk", ""].map((h) => (
                    <th key={h} className="border-b border-gray-200 bg-blue-50/60 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((r) => {
                  const open = expandedResource === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-2.5 font-medium text-gray-900">{r.name}</td>
                        <td className="px-3 py-2.5"><Pill tone={r.sensitivityTone}>{r.sensitivity}</Pill></td>
                        <td className="px-3 py-2.5 text-gray-600">{r.current}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.proposed}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.added > 0 ? `+${r.added}` : "0"}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.removed > 0 ? `-${r.removed}` : "0"}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.permission}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.scope}</td>
                        <td className="px-3 py-2.5"><Pill tone={RISK_TONE[r.risk]}>{r.risk}</Pill></td>
                        <td className="px-3 py-2.5">
                          {r.detail && (
                            <ExpandButton
                              open={open}
                              onClick={() => setExpandedResource(open ? null : r.id)}
                            />
                          )}
                        </td>
                      </tr>
                      {open && r.detail && (
                        <tr key={`${r.id}-detail`} className="border-b border-gray-100 bg-slate-50">
                          <td colSpan={10} className="p-3.5">
                            <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                              <b className="text-sm text-gray-800">Principal changes for {r.name}</b>
                              <table className="mt-2.5 w-full border-collapse text-sm">
                                <thead>
                                  <tr>
                                    {["Principal", "Current", "Proposed", "Effective result"].map((h) => (
                                      <th key={h} className="border-b border-gray-200 bg-blue-50/60 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.detail.map((d) => (
                                    <tr key={d.principal}>
                                      <td className="px-2.5 py-2 text-gray-800">{d.principal}</td>
                                      <td className="px-2.5 py-2 text-gray-600">{d.current}</td>
                                      <td className="px-2.5 py-2 text-gray-600">{d.proposed}</td>
                                      <td className="px-2.5 py-2"><Pill tone="red">{d.result}</Pill></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EFFECTIVE ACCESS GRAPH ── */}
      {subTab === "graph" && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Effective access graph</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Principal → permission → resource → scope. The graph shows effective, not merely direct, access
              changes.
            </p>
          </div>
          <div className="relative h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-[radial-gradient(#dbe4f2_1px,transparent_1px)] [background-size:20px_20px]">
            <div className="absolute right-3 top-3 z-10 flex gap-1.5">
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"><ZoomIn className="h-4 w-4" /></button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"><ZoomOut className="h-4 w-4" /></button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"><Maximize2 className="h-4 w-4" /></button>
            </div>
            <svg viewBox="0 0 1200 420" className="h-full w-full">
              <defs>
                <marker id="impact-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#8390a6" />
                </marker>
              </defs>
              <g stroke="#8390a6" strokeWidth="2" fill="none" markerEnd="url(#impact-arrow)">
                <path d="M170 100 L390 100" />
                <path d="M470 100 L700 100" />
                <path d="M790 100 L1030 100" />
                <path d="M170 210 L390 210" />
                <path d="M470 210 L700 210" />
                <path d="M790 210 L1030 210" />
                <path d="M170 320 L390 320" />
                <path d="M470 320 L700 320" />
                <path d="M790 320 L1030 320" />
              </g>
              <g fontFamily="Inter, Arial" fontSize="13" textAnchor="middle">
                <g>
                  <rect x="60" y="72" width="110" height="56" rx="10" fill="#eaf1ff" stroke="#6f96ff" />
                  <text x="115" y="96" fontWeight="800">FinanceAdmins</text>
                  <text x="115" y="115" fill="#647085">User group</text>
                </g>
                <g>
                  <rect x="390" y="72" width="80" height="56" rx="10" fill="#ffe2e2" stroke="#e07d7d" />
                  <text x="430" y="105" fontWeight="800">manage</text>
                </g>
                <g>
                  <rect x="700" y="72" width="90" height="56" rx="10" fill="#fff0d9" stroke="#e1ab62" />
                  <text x="745" y="105" fontWeight="800">all-resources</text>
                </g>
                <g>
                  <rect x="1030" y="72" width="95" height="56" rx="10" fill="#eef1f5" stroke="#aab3c2" />
                  <text x="1078" y="105" fontWeight="800">tenancy</text>
                </g>
                <g>
                  <rect x="40" y="182" width="130" height="56" rx="10" fill="#eaf1ff" stroke="#6f96ff" />
                  <text x="105" y="206" fontWeight="800">deployment-agents</text>
                  <text x="105" y="225" fill="#647085">Dynamic group</text>
                </g>
                <g>
                  <rect x="390" y="182" width="80" height="56" rx="10" fill="#fff0d9" stroke="#e1ab62" />
                  <text x="430" y="215" fontWeight="800">manage</text>
                </g>
                <g>
                  <rect x="700" y="182" width="90" height="56" rx="10" fill="#fff0d9" stroke="#e1ab62" />
                  <text x="745" y="215" fontWeight="800">secret-family</text>
                </g>
                <g>
                  <rect x="1030" y="182" width="95" height="56" rx="10" fill="#eef1f5" stroke="#aab3c2" />
                  <text x="1078" y="215" fontWeight="800">Security</text>
                </g>
                <g>
                  <rect x="60" y="292" width="110" height="56" rx="10" fill="#efe8ff" stroke="#9b77dc" />
                  <text x="115" y="316" fontWeight="800">objectstorage</text>
                  <text x="115" y="335" fill="#647085">Service principal</text>
                </g>
                <g>
                  <rect x="390" y="292" width="80" height="56" rx="10" fill="#ffe2e2" stroke="#e07d7d" />
                  <text x="430" y="325" fontWeight="800">removed</text>
                </g>
                <g>
                  <rect x="700" y="292" width="90" height="56" rx="10" fill="#fff0d9" stroke="#e1ab62" />
                  <text x="745" y="325" fontWeight="800">keys</text>
                </g>
                <g>
                  <rect x="1030" y="292" width="95" height="56" rx="10" fill="#eef1f5" stroke="#aab3c2" />
                  <text x="1078" y="325" fontWeight="800">Security</text>
                </g>
              </g>
              <g fontFamily="Inter, Arial" fontSize="11" fontWeight="800">
                <text x="280" y="90" fill="#cf2f2f">expanded</text>
                <text x="280" y="200" fill="#bd6a00">expanded</text>
                <text x="280" y="310" fill="#7247c7">removed</text>
              </g>
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />Principal</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-600" />Critical / removed</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-600" />Expanded</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-purple-600" />Service principal</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />Scope</span>
          </div>
        </div>
      )}

      {/* ── RISK & FINDINGS ── */}
      {subTab === "findings" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-sm font-bold text-gray-800">
              Risk findings
            </div>
            <div className="divide-y divide-gray-100 px-3.5">
              {FINDINGS.map((f) => (
                <div key={f.title} className="flex items-start gap-3 py-3.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold ${
                      f.info ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {f.info ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{f.detail}</p>
                  </div>
                  <Pill tone={f.tone}>{f.badge}</Pill>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-gray-200 p-3.5">
              <h3 className="text-sm font-bold text-gray-900">Recommended reviewer focus</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Review tenancy-wide scope, condition removal, access to security infrastructure, and access-loss
                scenarios that may interrupt services.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3.5">
              <h3 className="text-sm font-bold text-gray-900">Effective access methodology</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                The analysis evaluates the draft against all active policies in the tenancy. Duplicate grants,
                overlapping permissions, and broader inherited access are resolved before an impact is classified.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3.5">
              <h3 className="text-sm font-bold text-gray-900">Approval recommendation</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                <Pill tone="red">Manual security review required</Pill>
                <br />
                <br />
                The draft introduces critical privilege expansion and should not follow an auto-approval route.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3.5">
              <h3 className="text-sm font-bold text-gray-900">Evidence retained</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Principal, permission, resource, scope, condition, overlapping-policy resolution, risk rationale,
                analysis timestamp, and policy version are retained for audit.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
