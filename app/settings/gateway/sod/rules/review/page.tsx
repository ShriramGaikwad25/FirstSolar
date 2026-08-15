"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, FileText, FolderTree, ShieldCheck, UserRound } from "lucide-react";

const SOD_RULE_VIEW_STORAGE_KEY = "sodRuleViewDraft";

type RuleViewData = {
  ruleId: string;
  name: string;
  description: string;
  owner: string;
  createdOn: string;
  businessProcess: string;
};

const EMPTY_DATA: RuleViewData = {
  ruleId: "",
  name: "",
  description: "",
  owner: "",
  createdOn: "",
  businessProcess: "",
};

type RuleEntitlementRow = {
  Rule_ID?: string;
  Application?: string;
  Entitlement_Name?: string;
  Risk?: string;
};

export default function SodRuleReviewPage() {
  const [data, setData] = useState<RuleViewData>(EMPTY_DATA);
  const [hasData, setHasData] = useState(false);
  const [catalogItems, setCatalogItems] = useState<RuleEntitlementRow[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOD_RULE_VIEW_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<RuleViewData>;
      setData({
        ruleId: parsed.ruleId ?? "",
        name: parsed.name ?? "",
        description: parsed.description ?? "",
        owner: parsed.owner ?? "",
        createdOn: parsed.createdOn ?? "",
        businessProcess: parsed.businessProcess ?? "",
      });
      setHasData(true);
    } catch (error) {
      console.error("Unable to load rule review data:", error);
    }
  }, []);

  useEffect(() => {
    if (!hasData || !data.ruleId.trim()) {
      setCatalogItems([]);
      return;
    }

    let cancelled = false;

    const loadRuleCatalog = async () => {
      try {
        setIsCatalogLoading(true);
        const response = await fetch("/RuleEntitlement.json");
        if (!response.ok) {
          throw new Error(`Failed to load RuleEntitlement.json: ${response.status}`);
        }

        const json = (await response.json()) as RuleEntitlementRow[];
        if (cancelled) return;

        const targetRuleId = data.ruleId.trim().toLowerCase();
        const filtered = Array.isArray(json)
          ? json.filter(
              (row) => (row.Rule_ID ?? "").toString().trim().toLowerCase() === targetRuleId
            )
          : [];

        setCatalogItems(filtered);
      } catch (error) {
        console.error("Unable to load related rule entitlements:", error);
        if (!cancelled) setCatalogItems([]);
      } finally {
        if (!cancelled) setIsCatalogLoading(false);
      }
    };

    loadRuleCatalog();

    return () => {
      cancelled = true;
    };
  }, [data.ruleId, hasData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review Rule</h1>
              <p className="mt-1 text-xs text-gray-600">
                Review rule details before making updates.
              </p>
            </div>
            {hasData && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {data.ruleId || "Rule"}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!hasData ? (
            <p className="text-sm text-gray-600">
              No rule selected. Please use the View action from the Rules tab.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Rule ID
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.ruleId || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Rule Name
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
                    Created On
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.createdOn || "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Business Process Name
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.businessProcess || "-"}</p>
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

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Catalog
                </p>
                {isCatalogLoading ? (
                  <p className="text-xs text-gray-500">Loading catalog...</p>
                ) : catalogItems.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No related entitlement found for this rule.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {catalogItems.map((item, index) => (
                      <li
                        key={`${item.Rule_ID ?? "rule"}-${item.Entitlement_Name ?? "entitlement"}-${index}`}
                        className="rounded-md border border-gray-200 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900 truncate">
                            {item.Entitlement_Name || "-"}
                          </span>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {item.Risk ? (
                              <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                                {item.Risk} Risk
                              </span>
                            ) : null}
                            {item.Application ? (
                              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                {item.Application}
                              </span>
                            ) : null}
                          </div>
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
