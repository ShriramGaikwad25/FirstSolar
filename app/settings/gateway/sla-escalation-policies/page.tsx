"use client";

import { useMemo, useState } from "react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import {
  INITIAL_SLA_POLICIES,
  APPLIES_TO_OPTIONS,
  CLOCK_TYPE_OPTIONS,
  CLOCK_STARTS_OPTIONS,
  REMINDER_WHEN_OPTIONS,
  REMINDER_TARGET_OPTIONS,
  ESCALATE_TO_OPTIONS,
  BREACH_ACTION_OPTIONS,
  DEFERRAL_OPTIONS,
  MAX_DEFERRAL_OPTIONS,
  type SlaPolicy,
  type SlaDomain,
  type SlaStatus,
} from "@/components/continuous-compliance/slaEscalationPoliciesData";

const EMPTY_DRAFT = {
  name: "",
  domain: "User" as SlaDomain,
  status: "Draft" as SlaStatus,
  appliesTo: APPLIES_TO_OPTIONS[0],
  clockType: CLOCK_TYPE_OPTIONS[0],
  duration: "5",
  clockStarts: CLOCK_STARTS_OPTIONS[0],
  reminderWhen: REMINDER_WHEN_OPTIONS[0],
  reminderTarget: REMINDER_TARGET_OPTIONS[0],
  escalateTo: ESCALATE_TO_OPTIONS[0],
  breachAction: BREACH_ACTION_OPTIONS[0],
  deferral: DEFERRAL_OPTIONS[0],
  maxDeferral: MAX_DEFERRAL_OPTIONS[0],
  closure: "Approved, remediated, rejected with reason, or exception accepted with evidence.",
  owner: "",
};

function domainPillClass(domain: SlaDomain) {
  if (domain === "User") return "bg-blue-100 text-blue-800";
  if (domain === "Application") return "bg-purple-100 text-purple-700";
  return "bg-green-100 text-green-700";
}

function statusPillClass(status: SlaStatus) {
  return status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600";
}

function prefixForDomain(domain: SlaDomain) {
  if (domain === "User") return "SLA-U";
  if (domain === "Application") return "SLA-A";
  return "SLA-AC";
}

export default function SlaEscalationPoliciesPage() {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [policies, setPolicies] = useState<SlaPolicy[]>(INITIAL_SLA_POLICIES);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState(false);

  const stats = useMemo(() => {
    const active = policies.filter((p) => p.status === "Active").length;
    return { active };
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies.filter((p) => {
      const haystack = [p.id, p.name, p.domain, p.appliesTo, p.owner, p.escalation].join(" ").toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesDomain = !domainFilter || p.domain === domainFilter;
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesDomain && matchesStatus;
    });
  }, [policies, search, domainFilter, statusFilter]);

  const openCreatePolicySidebar = () => {
    const CreatePolicyForm = () => {
      const [draft, setDraft] = useState(EMPTY_DRAFT);
      const nextId = `${prefixForDomain(draft.domain)}-${String(
        policies.filter((p) => p.id.startsWith(prefixForDomain(draft.domain))).length + 1
      ).padStart(3, "0")}`;

      const handleSave = () => {
        const policy: SlaPolicy = {
          id: nextId,
          name: draft.name.trim() || "New SLA Policy",
          domain: draft.domain,
          appliesTo: draft.appliesTo,
          sla: `${draft.duration} ${draft.clockType.toLowerCase()}`,
          reminder: `${draft.reminderWhen} → ${draft.reminderTarget}`,
          escalation: draft.escalateTo,
          breach: draft.breachAction,
          owner: draft.owner.trim() || "IAM Governance",
          status: draft.status,
        };
        setPolicies((prev) => [policy, ...prev]);
        closeSidebar();
        setToast(true);
      };

      return (
        <div>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Define reusable timing, reminder, escalation, and breach-handling rules for Continuous Compliance
            events.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Policy Name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Entitlement Metadata SLA"
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Domain</label>
                <select
                  value={draft.domain}
                  onChange={(e) => setDraft((prev) => ({ ...prev, domain: e.target.value as SlaDomain }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>User</option>
                  <option>Application</option>
                  <option>Account</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as SlaStatus }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>Draft</option>
                  <option>Active</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Applies To</label>
              <select
                value={draft.appliesTo}
                onChange={(e) => setDraft((prev) => ({ ...prev, appliesTo: e.target.value }))}
                className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {APPLIES_TO_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Clock Type</label>
                <select
                  value={draft.clockType}
                  onChange={(e) => setDraft((prev) => ({ ...prev, clockType: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CLOCK_TYPE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">SLA Duration</label>
                <input
                  type="number"
                  min={1}
                  value={draft.duration}
                  onChange={(e) => setDraft((prev) => ({ ...prev, duration: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Clock Starts</label>
                <select
                  value={draft.clockStarts}
                  onChange={(e) => setDraft((prev) => ({ ...prev, clockStarts: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CLOCK_STARTS_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm font-semibold text-gray-800 mb-3">Reminder & Escalation</div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Reminder 1</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">When</label>
                    <select
                      value={draft.reminderWhen}
                      onChange={(e) => setDraft((prev) => ({ ...prev, reminderWhen: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {REMINDER_WHEN_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Notify</label>
                    <select
                      value={draft.reminderTarget}
                      onChange={(e) => setDraft((prev) => ({ ...prev, reminderTarget: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {REMINDER_TARGET_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Breach Escalation</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Escalate To</label>
                    <select
                      value={draft.escalateTo}
                      onChange={(e) => setDraft((prev) => ({ ...prev, escalateTo: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {ESCALATE_TO_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Breach Action</label>
                    <select
                      value={draft.breachAction}
                      onChange={(e) => setDraft((prev) => ({ ...prev, breachAction: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {BREACH_ACTION_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm font-semibold text-gray-800 mb-3">Deferral & Closure</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Allow Deferral</label>
                  <select
                    value={draft.deferral}
                    onChange={(e) => setDraft((prev) => ({ ...prev, deferral: e.target.value }))}
                    className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {DEFERRAL_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Max Deferral</label>
                  <select
                    value={draft.maxDeferral}
                    onChange={(e) => setDraft((prev) => ({ ...prev, maxDeferral: e.target.value }))}
                    className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {MAX_DEFERRAL_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm text-gray-700 mb-1">Closure Condition</label>
                <textarea
                  value={draft.closure}
                  onChange={(e) => setDraft((prev) => ({ ...prev, closure: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm text-gray-700 mb-1">Policy Owner</label>
                <input
                  value={draft.owner}
                  onChange={(e) => setDraft((prev) => ({ ...prev, owner: e.target.value }))}
                  placeholder="e.g., IAM Governance"
                  className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-800 mb-2">Policy Preview</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Generated ID</span>
                  <span className="font-medium text-gray-800">{nextId}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">SLA</span>
                  <span className="font-medium text-gray-800">
                    {draft.duration} {draft.clockType.toLowerCase()}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Reminder</span>
                  <span className="font-medium text-gray-800 text-right">
                    {draft.reminderWhen} → {draft.reminderTarget}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Escalate To</span>
                  <span className="font-medium text-gray-800 text-right">{draft.escalateTo}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Breach Action</span>
                  <span className="font-medium text-gray-800 text-right">{draft.breachAction}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-gray-800">{draft.status}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-8">
            <button type="button" className="px-4 py-2 border rounded text-sm" onClick={closeSidebar}>
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded text-sm text-white bg-blue-600 hover:bg-blue-700"
              onClick={handleSave}
            >
              Save Policy
            </button>
          </div>
        </div>
      );
    };

    openSidebar(<CreatePolicyForm />, { title: "Create SLA Policy", widthPx: 560 });
  };

  return (
    <div className="h-full">
      <div className="w-full px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SLA & Escalation Policies</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Create reusable policy objects that define response timelines, reminders, escalation targets, breach
              handling, and closure rules for Continuous Compliance access reviews and assurance events.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreatePolicySidebar}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Create SLA Policy
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Active Policies</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.active}</div>
            <div className="text-xs text-gray-500 mt-1">Across all event families</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Strictest SLA</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">1 day</div>
            <div className="text-xs text-gray-500 mt-1">Terminated user access events</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Escalation Personas</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">9</div>
            <div className="text-xs text-gray-500 mt-1">Dynamic user types + teams</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Breach Actions</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">4</div>
            <div className="text-xs text-gray-500 mt-1">Escalate, ticket, freeze, exception</div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Policy Registry</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Reusable SLA policies applied to User, Application, and Account continuous compliance events.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search policy name, target, owner..."
                className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Domains</option>
                <option value="User">User Events</option>
                <option value="Application">Application Events</option>
                <option value="Account">Account Events</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Applies To</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Reminder / Escalation</th>
                  <th className="px-4 py-3">Breach Action</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPolicies.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.id}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${domainPillClass(
                          p.domain
                        )}`}
                      >
                        {p.domain}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{p.appliesTo}</td>
                    <td className="px-4 py-3 align-top text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {p.sla}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">
                      <div className="font-semibold text-gray-900">{p.reminder}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Escalate: {p.escalation}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{p.breach}</td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{p.owner}</td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <button
                        type="button"
                        onClick={openCreatePolicySidebar}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPolicies.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                      No policies match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ActionCompletedToast
        isVisible={toast}
        message="Policy saved and added to registry."
        onClose={() => setToast(false)}
        duration={2400}
      />
    </div>
  );
}
