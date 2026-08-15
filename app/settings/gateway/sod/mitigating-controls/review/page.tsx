"use client";

import React, { useEffect, useState } from "react";
import { FileText, FolderTree, ShieldCheck, UserRound } from "lucide-react";

const SOD_MITIGATING_CONTROL_VIEW_STORAGE_KEY = "sodMitigatingControlViewDraft";

type MitigatingControlViewData = {
  id: string;
  name: string;
  description: string;
  type: string;
  method: string;
  applicablePolicyId: string;
  owner: string;
};

type SodPolicyJson = {
  Policy_ID?: string;
  Policy_Name?: string;
};

const EMPTY_DATA: MitigatingControlViewData = {
  id: "",
  name: "",
  description: "",
  type: "",
  method: "",
  applicablePolicyId: "",
  owner: "",
};

export default function SodMitigatingControlReviewPage() {
  const [data, setData] = useState<MitigatingControlViewData>(EMPTY_DATA);
  const [hasData, setHasData] = useState(false);
  const [mappedPolicies, setMappedPolicies] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOD_MITIGATING_CONTROL_VIEW_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<MitigatingControlViewData>;
      setData({
        id: parsed.id ?? "",
        name: parsed.name ?? "",
        description: parsed.description ?? "",
        type: parsed.type ?? "",
        method: parsed.method ?? "",
        applicablePolicyId: parsed.applicablePolicyId ?? "",
        owner: parsed.owner ?? "",
      });
      setHasData(true);
    } catch (error) {
      console.error("Unable to load mitigating control review data:", error);
    }
  }, []);

  useEffect(() => {
    if (!hasData || !data.applicablePolicyId.trim()) {
      setMappedPolicies([]);
      return;
    }

    let cancelled = false;

    const loadMappedPolicies = async () => {
      try {
        const response = await fetch("/SODPolicy.json");
        if (!response.ok) {
          throw new Error(`Failed to load SODPolicy.json: ${response.status}`);
        }

        const json = (await response.json()) as SodPolicyJson[];
        if (cancelled) return;

        const policyMap = new Map<string, string>();
        json.forEach((policy) => {
          const id = (policy.Policy_ID ?? "").trim();
          const name = (policy.Policy_Name ?? "").trim();
          if (!id) return;
          policyMap.set(id.toLowerCase(), name || id);
        });

        const ids = data.applicablePolicyId
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);

        const mapped = ids.map((id) => ({
          id,
          name: policyMap.get(id.toLowerCase()) ?? id,
        }));

        setMappedPolicies(mapped);
      } catch (error) {
        console.error("Unable to load mapped policy names:", error);
        if (!cancelled) setMappedPolicies([]);
      }
    };

    loadMappedPolicies();

    return () => {
      cancelled = true;
    };
  }, [data.applicablePolicyId, hasData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review Mitigating Control</h1>
              <p className="mt-1 text-xs text-gray-600">
                Review mitigating control details before making updates.
              </p>
            </div>
            {hasData && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {data.id || "Mitigating Control"}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!hasData ? (
            <p className="text-sm text-gray-600">
              No mitigating control selected. Please use the View action from the Mitigating
              Controls tab.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Control ID
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.id || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Name
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.name || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <UserRound className="h-4 w-4 text-blue-600" />
                    Owner
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.owner || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Type
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.type || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Method
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.method || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Applicable Policy ID
                  </p>
                  <p className="text-xs font-medium text-gray-900 whitespace-pre-wrap">
                    {data.applicablePolicyId || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Description
                </p>
                <p className="text-xs leading-5 text-gray-900 whitespace-pre-wrap">
                  {data.description || "-"}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 bg-gray-50">
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Mapped Policies
                  </p>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {mappedPolicies.length}
                  </span>
                </div>

                {mappedPolicies.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-700">No mapped policy found.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {mappedPolicies.map((policy) => (
                      <li key={policy.id} className="px-3 py-2.5 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            {policy.id}
                          </span>
                          <span className="text-gray-900 leading-5">{policy.name}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

