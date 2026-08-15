"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, FileText, FolderTree, ShieldCheck, Tag, UserRound } from "lucide-react";

const SOD_BP_VIEW_STORAGE_KEY = "sodBusinessProcessViewDraft";

type BusinessProcessViewData = {
  bpId: string;
  name: string;
  owner: string;
  tags: string;
  description: string;
  dateCreated: string;
};

type SodRuleJson = {
  Rule_ID?: string;
  Rule_Name?: string;
  "Business Process ID"?: string;
  "Business Process Name"?: string;
};

type MappedRule = {
  ruleId: string;
  ruleName: string;
};

const EMPTY_DATA: BusinessProcessViewData = {
  bpId: "",
  name: "",
  owner: "",
  tags: "",
  description: "",
  dateCreated: "",
};

export default function SodBusinessProcessReviewPage() {
  const [data, setData] = useState<BusinessProcessViewData>(EMPTY_DATA);
  const [hasData, setHasData] = useState(false);
  const [mappedRules, setMappedRules] = useState<MappedRule[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOD_BP_VIEW_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<BusinessProcessViewData>;
      setData({
        bpId: parsed.bpId ?? "",
        name: parsed.name ?? "",
        owner: parsed.owner ?? "",
        tags: parsed.tags ?? "",
        description: parsed.description ?? "",
        dateCreated: parsed.dateCreated ?? "",
      });
      setHasData(true);
    } catch (error) {
      console.error("Unable to load business process review data:", error);
    }
  }, []);

  useEffect(() => {
    if (!hasData || !data.bpId) {
      setMappedRules([]);
      return;
    }

    let cancelled = false;

    const loadMappedRules = async () => {
      try {
        const response = await fetch("/SOdRules.json");
        if (!response.ok) {
          throw new Error(`Failed to load SOdRules.json: ${response.status}`);
        }

        const json = (await response.json()) as SodRuleJson[];
        if (cancelled) return;

        const rules = json
          .filter(
            (rule) =>
              rule["Business Process ID"] === data.bpId ||
              rule["Business Process Name"] === data.name
          )
          .map((rule) => ({
            ruleId: rule.Rule_ID ?? "",
            ruleName: rule.Rule_Name ?? "",
          }));

        setMappedRules(rules);
      } catch (error) {
        console.error("Unable to load mapped rules:", error);
      }
    };

    loadMappedRules();

    return () => {
      cancelled = true;
    };
  }, [data.bpId, data.name, hasData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review Business Process</h1>
              <p className="mt-1 text-xs text-gray-600">
                Review details and mapped rules before taking further actions.
              </p>
            </div>
            {hasData && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {data.bpId || "BP"}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!hasData ? (
            <p className="text-sm text-gray-600">
              No business process selected. Please use the View action from the Business Process tab.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    BP ID
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.bpId || "-"}</p>
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
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Date Created
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.dateCreated || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <Tag className="h-4 w-4 text-blue-600" />
                    Tags
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.tags || "-"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Description
                </p>
                <p className="text-xs leading-5 text-gray-900 whitespace-pre-wrap">{data.description || "-"}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Mapped Rules</p>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {mappedRules.length} {mappedRules.length === 1 ? "Rule" : "Rules"}
                  </span>
                </div>
                {mappedRules.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-700">No rules mapped to this business process.</p>
                ) : (
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Rule ID
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Rule Name
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {mappedRules.map((rule, index) => (
                          <tr
                            key={`${rule.ruleId}-${rule.ruleName}`}
                            className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                          >
                            <td className="px-3 py-2 text-xs font-medium text-gray-900">{rule.ruleId || "-"}</td>
                            <td className="px-3 py-2 text-xs text-gray-900">{rule.ruleName || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
