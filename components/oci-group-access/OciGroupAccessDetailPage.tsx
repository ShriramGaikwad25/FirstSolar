"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Users, WifiOff } from "lucide-react";
import {
  OciGroupMembersTable,
  OciGroupResourcesTable,
  OciGroupStatementsTable,
} from "@/components/oci-group-access/OciGroupAccessDetailTables";
import { useOciGroupAccessDetail } from "@/hooks/useOciGroupAccess";
import { defaultOciTenancy } from "@/lib/oci-tenancy-metadata";

type GroupAccessTab = "members" | "statements" | "resources";

const TABS: { id: GroupAccessTab; label: string }[] = [
  { id: "members", label: "Members" },
  { id: "statements", label: "Statements" },
  { id: "resources", label: "Resources" },
];

export default function OciGroupAccessDetailPage({ groupName }: { groupName: string }) {
  const tenancyId = defaultOciTenancy().id;
  const { data, isLoading, isError, error } = useOciGroupAccessDetail(groupName, tenancyId);
  const [activeTab, setActiveTab] = useState<GroupAccessTab>("members");

  const group = data?.group;
  const configured = data?.configured ?? false;

  return (
    <div className="w-full min-w-0 pb-8">
      <header className="mb-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-900">{groupName}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {group?.description || "Group access details"}
            </p>
            {group ? (
              <p className="mt-2 text-xs text-gray-500 tabular-nums">
                {group.memberCount.toLocaleString()} members ·{" "}
                {group.statementCount.toLocaleString()} statements ·{" "}
                {group.resourceCount.toLocaleString()} resources
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {!configured && !isLoading && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Sign in to load group access from KeyForge.</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading group access…
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Failed to load group access"}
        </div>
      )}

      {!isLoading && !isError && group && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div
            className="flex flex-wrap gap-2 border-b border-blue-100 bg-blue-50/80 px-4 py-3"
            role="tablist"
            aria-label="Group access sections"
          >
            {TABS.map((tab) => {
              const selected = activeTab === tab.id;
              const count =
                tab.id === "members"
                  ? group.members.length
                  : tab.id === "statements"
                    ? group.statements.length
                    : group.resources.length;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    selected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-100"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 text-xs font-normal tabular-nums ${
                      selected ? "text-blue-100" : "text-blue-600/70"
                    }`}
                  >
                    ({count.toLocaleString()})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-1" role="tabpanel">
            {activeTab === "members" && <OciGroupMembersTable members={group.members} />}
            {activeTab === "statements" && <OciGroupStatementsTable statements={group.statements} />}
            {activeTab === "resources" && <OciGroupResourcesTable resources={group.resources} />}
          </div>
        </div>
      )}

      {!isLoading && !isError && !group && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
          Group not found.{" "}
          <Link href="/oci-policy-analysis/group-access" className="text-blue-700 hover:underline">
            Return to group list
          </Link>
          .
        </div>
      )}
    </div>
  );
}
