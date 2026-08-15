"use client";

import { useMemo, useState } from "react";
import AsyncSelect from "react-select/async";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import { customOption, loadUsers, loadGroups } from "@/components/MsAsyncData";
import {
  INITIAL_EVENT_DEFINITIONS,
  type EventDefinition,
  type EventDomain,
  type EventAction,
  type EventStatus,
  type EventFrequency,
} from "@/components/continuous-compliance/eventDefinitionsData";

type OwnerOption = { value: string; label: string; image?: string };

const SUBTYPES: Record<EventDomain, string[]> = {
  User: ["Role", "Job Title", "Department", "Manager"],
  Application: [
    "Newly Discovered Entitlement",
    "Entitlement Description",
    "Privilege Access Flag",
    "Training Code",
    "Application Owner",
    "Entitlement Owner",
    "Data Classification",
    "SOD Flag",
  ],
  Account: ["Service A/c", "Orphan A/c", "Inactive A/c"],
};

const CONDITIONS: Record<string, string[]> = {
  Role: ["Missing", "Change"],
  "Job Title": ["Missing", "Change"],
  Department: ["Missing", "Change"],
  Manager: ["Missing", "Change"],
  "Newly Discovered Entitlement": ["Discovered"],
  "Entitlement Description": ["Missing", "Less than 80 characters"],
  "Privilege Access Flag": ["Change"],
  "Training Code": ["Change"],
  "Application Owner": ["Missing", "Inactive", "Change"],
  "Entitlement Owner": ["Missing", "Inactive", "Change"],
  "Data Classification": ["Missing", "Change"],
  "SOD Flag": ["Added", "Missing"],
  "Service A/c": ["Owner missing", "Owner Inactive"],
  "Orphan A/c": ["Detected"],
  "Inactive A/c": ["30 days inactive", "60 days inactive", "90 days inactive"],
};

const DEFAULT_SCOPE: Record<EventDomain, string> = {
  User: "All Users",
  Application: "All Applications",
  Account: "All Accounts",
};

const SCOPE_OPTIONS: Record<EventDomain, string[]> = {
  User: ["All Users", "Specific Filter"],
  Application: ["All Applications", "Specific Filter"],
  Account: ["All Accounts", "Specific Filter"],
};

const EMPTY_DRAFT = {
  name: "",
  domain: "User" as EventDomain,
  subtype: SUBTYPES.User[0],
  condition: CONDITIONS[SUBTYPES.User[0]][0],
  action: "Assurance Event" as EventAction,
  scope: DEFAULT_SCOPE.User,
  specificFilter: "",
  sla: "5",
  status: "Active" as EventStatus,
  frequency: "Daily" as EventFrequency,
  ownerType: "User" as "User" | "Group",
  ownerOption: null as OwnerOption | null,
  description: "",
};

function statusPillClass(status: EventStatus) {
  if (status === "Active") return "bg-green-100 text-green-700";
  if (status === "Draft") return "bg-gray-100 text-gray-600";
  return "bg-red-100 text-red-700";
}

function actionPillClass(action: EventAction) {
  return action === "Assurance Event" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700";
}

export default function ContinuousComplianceEventDefinitionsPage() {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [events, setEvents] = useState<EventDefinition[]>(INITIAL_EVENT_DEFINITIONS);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState(false);

  const stats = useMemo(() => {
    const active = events.filter((e) => e.status === "Active").length;
    const assurance = events.filter((e) => e.action === "Assurance Event").length;
    const review = events.filter((e) => e.action === "Access Review").length;
    const avgSla = events.length
      ? (events.reduce((sum, e) => sum + e.slaDays, 0) / events.length).toFixed(1)
      : "0.0";
    return { active, assurance, review, avgSla };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const matchesSearch =
        !q ||
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.subtype.toLowerCase().includes(q);
      const matchesAction = !actionFilter || e.action === actionFilter;
      const matchesStatus = !statusFilter || e.status === statusFilter;
      return matchesSearch && matchesAction && matchesStatus;
    });
  }, [events, search, actionFilter, statusFilter]);

  const openCreateEventSidebar = () => {
    const CreateEventForm = () => {
      const [draft, setDraft] = useState(EMPTY_DRAFT);
      const subtypeOptions = SUBTYPES[draft.domain];
      const conditionOptions = CONDITIONS[draft.subtype] ?? ["Missing", "Change"];
      const previewScope =
        draft.scope === "Specific Filter" ? draft.specificFilter || "Specific Filter" : draft.scope;

      const handleDomainChange = (domain: EventDomain) => {
        const subtype = SUBTYPES[domain][0];
        const condition = (CONDITIONS[subtype] ?? ["Missing", "Change"])[0];
        setDraft((prev) => ({
          ...prev,
          domain,
          subtype,
          condition,
          scope: DEFAULT_SCOPE[domain],
          specificFilter: "",
        }));
      };

      const handleSubtypeChange = (subtype: string) => {
        const condition = (CONDITIONS[subtype] ?? ["Missing", "Change"])[0];
        setDraft((prev) => ({ ...prev, subtype, condition }));
      };

      const ownerLabel = draft.ownerOption
        ? draft.ownerType === "Group"
          ? `${draft.ownerOption.label} (Group)`
          : draft.ownerOption.label
        : "Unassigned";

      const handleSave = () => {
        const sla = Number.parseInt(draft.sla, 10) || 0;
        const nextId = `CCE-${1001 + events.length}`;
        const newEvent: EventDefinition = {
          id: nextId,
          name: draft.name.trim() || `${draft.condition} ${draft.subtype}`,
          domain: draft.domain,
          subtype: draft.subtype,
          condition: draft.condition,
          scope: previewScope,
          slaDays: sla,
          frequency: draft.frequency,
          owner: ownerLabel,
          status: draft.status,
          action: draft.action,
        };
        setEvents((prev) => [newEvent, ...prev]);
        closeSidebar();
        setToast(true);
      };

      return (
        <div>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Define the trigger condition. Workflow will handle downstream routing, agent task assignment, and
            remediation actions.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Event Name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Example: Missing Entitlement Owner"
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Event Domain</label>
                <select
                  value={draft.domain}
                  onChange={(e) => handleDomainChange(e.target.value as EventDomain)}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="User">User</option>
                  <option value="Application">Application</option>
                  <option value="Account">Account</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Event Object</label>
                <select
                  value={draft.subtype}
                  onChange={(e) => handleSubtypeChange(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {subtypeOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Condition</label>
                <select
                  value={draft.condition}
                  onChange={(e) => setDraft((prev) => ({ ...prev, condition: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {conditionOptions.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Action</label>
                <select
                  value={draft.action}
                  onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value as EventAction }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>Assurance Event</option>
                  <option>Access Review</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Scope</label>
                <select
                  value={draft.scope}
                  onChange={(e) => setDraft((prev) => ({ ...prev, scope: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SCOPE_OPTIONS[draft.domain].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">SLA (days)</label>
                <input
                  type="number"
                  min={1}
                  value={draft.sla}
                  onChange={(e) => setDraft((prev) => ({ ...prev, sla: e.target.value }))}
                  className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {draft.scope === "Specific Filter" && (
              <div>
                <label className="block text-sm text-gray-700 mb-1">Specific Filter</label>
                <input
                  value={draft.specificFilter}
                  onChange={(e) => setDraft((prev) => ({ ...prev, specificFilter: e.target.value }))}
                  placeholder="Example: app.riskTier = High AND app.type = ERP"
                  className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as EventStatus }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>Draft</option>
                  <option>Active</option>
                  <option>Disabled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Frequency</label>
                <select
                  value={draft.frequency}
                  onChange={(e) => setDraft((prev) => ({ ...prev, frequency: e.target.value as EventFrequency }))}
                  className="border rounded px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Event-based</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Owner</label>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden mb-2">
                {(["User", "Group"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, ownerType: type, ownerOption: null }))}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                      draft.ownerType === type
                        ? "bg-[#15274E] text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <AsyncSelect
                key={draft.ownerType}
                cacheOptions
                defaultOptions
                isSearchable
                isClearable
                loadOptions={draft.ownerType === "User" ? loadUsers : loadGroups}
                placeholder={draft.ownerType === "User" ? "Search for a user…" : "Search for a group…"}
                components={{ Option: customOption as any }}
                value={draft.ownerOption}
                onChange={(newValue) => setDraft((prev) => ({ ...prev, ownerOption: (newValue as OwnerOption) || null }))}
                menuPlacement="auto"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the governance defect this event detects and why it matters."
                className="border rounded px-3 py-2 text-sm w-full h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-800 mb-2">Event Preview</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Generated ID</span>
                  <span className="font-medium text-gray-800">CCE-{1001 + events.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Event Path</span>
                  <span className="font-medium text-gray-800 text-right">
                    {draft.domain} / {draft.subtype} / {draft.condition}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Scope</span>
                  <span className="font-medium text-gray-800 text-right">{previewScope}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">SLA</span>
                  <span className="font-medium text-gray-800">{draft.sla || "0"} days</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Frequency</span>
                  <span className="font-medium text-gray-800">{draft.frequency}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Owner</span>
                  <span className="font-medium text-gray-800 text-right">{ownerLabel}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-gray-800">{draft.status}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Action</span>
                  <span className="font-medium text-gray-800">{draft.action}</span>
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
              Save Event
            </button>
          </div>
        </div>
      );
    };

    openSidebar(<CreateEventForm />, { title: "Create Continuous Compliance Event", widthPx: 520 });
  };

  return (
    <div className="h-full">
      <div className="w-full px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Continuous Compliance Event Definitions</h1>
          </div>
          <button
            type="button"
            onClick={openCreateEventSidebar}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Create New Event
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Active Events</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.active}</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Assurance Events</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.assurance}</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Access Review Events</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.review}</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Avg SLA</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.avgSla}d</div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Event Registry</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Configured events available to Continuous Compliance and Workflow.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search event name or ID"
                className="w-52 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All actions</option>
                <option>Assurance Event</option>
                <option>Access Review</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All status</option>
                <option>Active</option>
                <option>Draft</option>
                <option>Disabled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Event Name</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
                        {event.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-semibold text-gray-900">{event.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {event.domain} › {event.subtype} › {event.condition}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">
                      {event.domain} / {event.subtype}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{event.scope}</td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{event.slaDays} days</td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{event.frequency}</td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{event.owner}</td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass(
                          event.status
                        )}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${actionPillClass(
                          event.action
                        )}`}
                      >
                        {event.action}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                      No events match the current filters.
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
        message="Event saved and added to registry."
        onClose={() => setToast(false)}
        duration={2400}
      />
    </div>
  );
}
