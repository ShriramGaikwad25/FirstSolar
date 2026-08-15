"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { ServiceAccountsPage } from "@/components/non-human-identity/ServiceAccountsPage";
import { LineageGraphPage } from "@/components/non-human-identity/LineageGraphPage";

type Tab = "details" | "lineage";

export function AiAgentDetailPageClient({ nhiId }: { nhiId: string }) {
  const [tab, setTab] = useState<Tab>("details");

  return (
    <div className="w-full min-w-0 space-y-4 pb-8">
      <Link
        href="/non-human-identity/ai-agent-inventory"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        AI Agent Inventory
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI Agent Details</h1>
        <p className="mt-1 text-sm text-slate-600">
          Loaded for agent <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{nhiId}</code> via the
          same identity APIs as service account management (no identity picker).
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab("details")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "details"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setTab("lineage")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "lineage"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Lineage
        </button>
      </div>

      {tab === "details" && (
        <ServiceAccountsPage
          key={nhiId}
          embeddedNhiId={nhiId}
          showIdentitySidebar={false}
          suppressPageHeader
          showServiceAccountChrome={false}
        />
      )}
      {tab === "lineage" && <LineageGraphPage key={nhiId} embeddedNhiId={nhiId} />}
    </div>
  );
}
