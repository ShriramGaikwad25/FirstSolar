"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { themeQuartz } from "ag-grid-community";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Search } from "lucide-react";
import "@/lib/ag-grid-setup";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import {
  assuranceEvents,
  type AssuranceEvent,
  type AssuranceEventStatus,
} from "./assuranceEventsData";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

const AGENT_PILL_CLASSES: Record<string, string> = {
  "Entitlement Description Generator": "bg-blue-50 text-blue-700",
  "Service Account Owner Resolver": "bg-emerald-50 text-emerald-700",
  "Data Classification Recommender": "bg-purple-50 text-purple-700",
  "Training Requirement Impact Analysis": "bg-amber-50 text-amber-700",
  "SoD Classification Validation Check": "bg-red-50 text-red-700",
};

function agentPillClass(agent: string): string {
  return AGENT_PILL_CLASSES[agent] ?? "bg-gray-100 text-gray-600";
}

const HIDE_DEFER_CREATE_TICKET_TYPES = new Set([
  "Entitlement description missing",
  "Entitlement description incomplete",
  "Service account owner inactive",
]);

const STATUS_DOT_CLASSES: Record<AssuranceEventStatus, string> = {
  Detected: "bg-blue-500",
  Reasoned: "bg-purple-500",
  "Pending Review": "bg-amber-500",
  Approved: "bg-emerald-500",
  Fulfilled: "bg-emerald-500",
  Failed: "bg-red-500",
  Closed: "bg-gray-400",
};

function StatusBadge({ status }: { status: AssuranceEventStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-700">
      <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
      {status}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="min-w-[100px]">
      <span className="text-sm font-semibold text-gray-800">{confidence}%</span>
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mt-1.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}

function AssuranceEventDetail({
  event,
  onAction,
}: {
  event: AssuranceEvent;
  onAction: (actionLabel: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${agentPillClass(
            event.agent
          )}`}
        >
          {event.agent}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {event.object} · {event.app} · {event.id}
      </p>

      <dl className="divide-y divide-gray-100">
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Status</dt>
          <dd className="col-span-2">
            <StatusBadge status={event.status} />
          </dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Source</dt>
          <dd className="col-span-2 text-gray-800">{event.source}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Current Value</dt>
          <dd className="col-span-2 text-gray-800">{event.current}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Recommended</dt>
          <dd className="col-span-2 text-gray-800">{event.recommended}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Confidence</dt>
          <dd className="col-span-2">
            <ConfidenceBar confidence={event.confidence} />
          </dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Reviewer</dt>
          <dd className="col-span-2 text-gray-800">{event.reviewer}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Owner</dt>
          <dd className="col-span-2 text-gray-800">{event.owner}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
          <dt className="font-semibold text-gray-500 col-span-1">Impact</dt>
          <dd className="col-span-2 text-gray-800">{event.impact}</dd>
        </div>
      </dl>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 mt-4">
        <strong className="block text-sm mb-1.5">Recommended Action</strong>
        <p className="text-sm text-gray-600 leading-relaxed m-0">{event.recommended}</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 mt-3">
        <strong className="block text-sm mb-1.5">Evidence Snapshot</strong>
        <p className="text-sm text-gray-600 leading-relaxed m-0">{event.evidence}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          onClick={() => onAction("Approve")}
        >
          {event.type === "Entitlement description incomplete" ? "Approved" : "Approve"}
        </button>
        {event.type !== "Entitlement description incomplete" && (
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-semibold hover:bg-red-100 transition-colors"
            onClick={() => onAction("Reject")}
          >
            Reject
          </button>
        )}
        {!HIDE_DEFER_CREATE_TICKET_TYPES.has(event.type) && (
          <>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold hover:bg-gray-50 transition-colors"
              onClick={() => onAction("Defer")}
            >
              Defer
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold hover:bg-gray-50 transition-colors"
              onClick={() => onAction("Create Ticket")}
            >
              Create Ticket
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const AGENTS = Array.from(new Set(assuranceEvents.map((e) => e.agent)));
const STATUSES: AssuranceEventStatus[] = [
  "Detected",
  "Reasoned",
  "Pending Review",
  "Approved",
  "Fulfilled",
  "Failed",
  "Closed",
];
const SOURCES = Array.from(new Set(assuranceEvents.map((e) => e.source)));

export default function AssuranceEventsTab() {
  const { openSidebar } = useRightSidebar();
  const [searchTerm, setSearchTerm] = useState("");
  const [agentFilter, setAgentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return assuranceEvents.filter((e) => {
      const matchesSearch =
        !q || Object.values(e).some((v) => String(v).toLowerCase().includes(q));
      return (
        matchesSearch &&
        (agentFilter === "All" || e.agent === agentFilter) &&
        (statusFilter === "All" || e.status === statusFilter) &&
        (sourceFilter === "All" || e.source === sourceFilter)
      );
    });
  }, [searchTerm, agentFilter, statusFilter, sourceFilter]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  const openEventDetail = (event: AssuranceEvent) => {
    openSidebar(
      <AssuranceEventDetail
        event={event}
        onAction={(actionLabel) => showToast(`${actionLabel} captured for ${event.id}.`)}
      />,
      { widthPx: 620, title: event.type }
    );
  };

  const columnDefs: ColDef[] = [
    {
      headerName: "Event",
      field: "type",
      flex: 1.6,
      cellRenderer: (params: ICellRendererParams<AssuranceEvent>) => (
        <div className="py-1">
          <span className="block font-semibold text-gray-900">{params.data?.type}</span>
          <span className="text-xs text-gray-500">
            {params.data?.id} · {params.data?.detected}
          </span>
        </div>
      ),
      autoHeight: true,
    },
    {
      headerName: "Object / Application",
      field: "object",
      flex: 1.4,
      cellRenderer: (params: ICellRendererParams<AssuranceEvent>) => (
        <div className="py-1">
          <span className="block font-semibold text-gray-900">{params.data?.object}</span>
          <span className="text-xs text-gray-500">{params.data?.app}</span>
        </div>
      ),
      autoHeight: true,
    },
    { headerName: "Source", field: "source", flex: 0.8 },
    {
      headerName: "Current Value",
      field: "current",
      flex: 1.2,
      wrapText: true,
      autoHeight: true,
      cellRenderer: (params: ICellRendererParams<AssuranceEvent>) => (
        <span className="text-sm text-gray-600">{params.data?.current}</span>
      ),
    },
    {
      headerName: "AI Agent Task",
      field: "agent",
      flex: 1.3,
      wrapText: true,
      autoHeight: true,
      cellRenderer: (params: ICellRendererParams<AssuranceEvent>) => (
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold leading-tight ${agentPillClass(
            params.data?.agent ?? ""
          )}`}
        >
          {params.data?.agent}
        </span>
      ),
    },
    {
      headerName: "Confidence",
      field: "confidence",
      flex: 1,
      cellRenderer: (params: ICellRendererParams<AssuranceEvent>) => (
        <ConfidenceBar confidence={params.data?.confidence ?? 0} />
      ),
    },
    {
      headerName: "Status",
      field: "status",
      flex: 1.1,
      cellRenderer: (params: ICellRendererParams<AssuranceEvent>) => (
        <StatusBadge status={params.data!.status} />
      ),
    },
    { headerName: "Owner", field: "owner", flex: 1 },
  ];

  return (
    <div className="w-full flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Event Queue</h3>
          <p className="text-sm text-gray-500 mt-1">
            Click any event to open the side panel with current value, recommended value, status, and actions.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
          {filteredEvents.length} visible
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <div className="sm:col-span-1 relative bg-white rounded-md border border-gray-300 flex items-center gap-2 px-3 py-2">
          <Search className="text-gray-400 w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search entity, app, owner, value..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 bg-transparent text-gray-700 focus:outline-none flex-1 text-sm"
          />
        </div>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All agent tasks</option>
          {AGENTS.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All sources</option>
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div className="ag-theme-alpine w-full">
        <AgGridReact
          theme={themeQuartz}
          rowData={filteredEvents}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: false,
            resizable: true,
            flex: 1,
          }}
          domLayout="autoHeight"
          onRowClicked={(e) => {
            if (e.data) openEventDetail(e.data as AssuranceEvent);
          }}
        />
      </div>

      {filteredEvents.length === 0 && (
        <div className="mt-3 text-sm text-gray-500">No events match the selected filters.</div>
      )}

      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        {(
          [
            ["Detected", "bg-blue-500"],
            ["Reasoned", "bg-purple-500"],
            ["Pending Review", "bg-amber-500"],
            ["Fulfilled / Closed", "bg-emerald-500"],
            ["Failed", "bg-red-500"],
          ] as const
        ).map(([label, dotClass]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
            {label}
          </span>
        ))}
      </div>

      <ActionCompletedToast
        isVisible={!!toastMessage}
        message={toastMessage ?? ""}
        onClose={() => setToastMessage(null)}
        duration={2000}
      />
    </div>
  );
}
