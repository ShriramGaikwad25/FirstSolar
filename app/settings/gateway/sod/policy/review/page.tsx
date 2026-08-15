"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, FileText, FolderTree, ShieldCheck, UserRound, Printer } from "lucide-react";

const SOD_POLICY_VIEW_STORAGE_KEY = "sodPolicyViewDraft";

type PolicyViewData = {
  policyId: string;
  name: string;
  description: string;
  owner: string;
  riskDefinition: string;
  businessProcess: string;
};

type SodRuleJson = {
  Rule_ID?: string;
  Rule_Name?: string;
};

type PolicyStatementRow = {
  policyId: string;
  statementType: "MASTER" | "CONFLICT";
  ruleId: string;
  ruleName: string;
  entitlements: string[];
};

type PolicyRulePair = {
  statementType: "MASTER" | "CONFLICT";
  ruleId: string;
};

type RuleEntitlementJson = {
  Rule_ID?: string;
  Entitlement_Name?: string;
};

const EMPTY_DATA: PolicyViewData = {
  policyId: "",
  name: "",
  description: "",
  owner: "",
  riskDefinition: "",
  businessProcess: "",
};

const POLICY_STATEMENT_MAPPING_BY_POLICY_ID: Record<string, PolicyRulePair[]> = {
  P1: [
    { statementType: "MASTER", ruleId: "R3" },
    { statementType: "CONFLICT", ruleId: "R1" },
    { statementType: "CONFLICT", ruleId: "R2" },
  ],
  P2: [
    { statementType: "MASTER", ruleId: "R2" },
    { statementType: "CONFLICT", ruleId: "R3" },
  ],
  P3: [
    { statementType: "MASTER", ruleId: "R1" },
    { statementType: "CONFLICT", ruleId: "R2" },
  ],
  P4: [
    { statementType: "MASTER", ruleId: "R5" },
    { statementType: "CONFLICT", ruleId: "R4" },
  ],
  P5: [
    { statementType: "MASTER", ruleId: "R6" },
    { statementType: "CONFLICT", ruleId: "R7" },
  ],
  P6: [
    { statementType: "MASTER", ruleId: "R8" },
    { statementType: "CONFLICT", ruleId: "R9" },
    { statementType: "CONFLICT", ruleId: "R7" },
  ],
  P7: [
    { statementType: "MASTER", ruleId: "R10" },
    { statementType: "CONFLICT", ruleId: "R11" },
  ],
  P8: [
    { statementType: "MASTER", ruleId: "R11" },
    { statementType: "CONFLICT", ruleId: "R12" },
  ],
  P9: [
    { statementType: "MASTER", ruleId: "R13" },
    { statementType: "CONFLICT", ruleId: "R12" },
    { statementType: "CONFLICT", ruleId: "R10" },
  ],
  P10: [
    { statementType: "MASTER", ruleId: "R6" },
    { statementType: "CONFLICT", ruleId: "R7" },
  ],
  P11: [
    { statementType: "MASTER", ruleId: "R7" },
    { statementType: "CONFLICT", ruleId: "R3" },
    { statementType: "CONFLICT", ruleId: "R5" },
  ],
  P12: [
    { statementType: "MASTER", ruleId: "R3" },
    { statementType: "CONFLICT", ruleId: "R8" },
    { statementType: "CONFLICT", ruleId: "R9" },
  ],
  P13: [
    { statementType: "MASTER", ruleId: "R10" },
    { statementType: "CONFLICT", ruleId: "R6" },
    { statementType: "CONFLICT", ruleId: "R7" },
  ],
  P14: [
    { statementType: "MASTER", ruleId: "R12" },
    { statementType: "CONFLICT", ruleId: "R7" },
  ],
  P15: [
    { statementType: "MASTER", ruleId: "R13" },
    { statementType: "CONFLICT", ruleId: "R3" },
    { statementType: "CONFLICT", ruleId: "R7" },
  ],
};

export default function SodPolicyReviewPage() {
  const [data, setData] = useState<PolicyViewData>(EMPTY_DATA);
  const [hasData, setHasData] = useState(false);
  const [policyStatements, setPolicyStatements] = useState<PolicyStatementRow[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOD_POLICY_VIEW_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<PolicyViewData>;
      setData({
        policyId: parsed.policyId ?? "",
        name: parsed.name ?? "",
        description: parsed.description ?? "",
        owner: parsed.owner ?? "",
        riskDefinition: parsed.riskDefinition ?? "",
        businessProcess: parsed.businessProcess ?? "",
      });
      setHasData(true);
    } catch (error) {
      console.error("Unable to load policy review data:", error);
    }
  }, []);

  useEffect(() => {
    if (!hasData || !data.policyId) {
      setPolicyStatements([]);
      return;
    }

    let cancelled = false;

    const loadPolicyStatements = async () => {
      try {
        const [rulesRes, ruleEntitlementsRes] = await Promise.all([
          fetch("/SOdRules.json"),
          fetch("/RuleEntitlement.json"),
        ]);
        if (!rulesRes.ok || !ruleEntitlementsRes.ok) return;

        const [rulesJson, ruleEntitlementsJson] = (await Promise.all([
          rulesRes.json(),
          ruleEntitlementsRes.json(),
        ])) as [SodRuleJson[], RuleEntitlementJson[]];
        if (cancelled) return;

        const ruleNameById: Record<string, string> = {};
        rulesJson.forEach((rule) => {
          const ruleId = (rule.Rule_ID ?? "").trim();
          if (!ruleId) return;
          ruleNameById[ruleId] = (rule.Rule_Name ?? "").trim();
        });

        const entitlementsByRuleId: Record<string, string[]> = {};
        ruleEntitlementsJson.forEach((item) => {
          const ruleId = (item.Rule_ID ?? "").trim();
          const entitlementName = (item.Entitlement_Name ?? "").trim();
          if (!ruleId || !entitlementName) return;
          if (!entitlementsByRuleId[ruleId]) {
            entitlementsByRuleId[ruleId] = [];
          }
          if (!entitlementsByRuleId[ruleId].includes(entitlementName)) {
            entitlementsByRuleId[ruleId].push(entitlementName);
          }
        });

        const mappedRules = POLICY_STATEMENT_MAPPING_BY_POLICY_ID[data.policyId] ?? [];
        if (mappedRules.length === 0) {
          setPolicyStatements([]);
          return;
        }

        const mapped: PolicyStatementRow[] = mappedRules.map((item) => ({
          policyId: data.policyId,
          statementType: item.statementType,
          ruleId: item.ruleId,
          ruleName: ruleNameById[item.ruleId] ?? "",
          entitlements: entitlementsByRuleId[item.ruleId] ?? [],
        }));

        setPolicyStatements(mapped);
      } catch (error) {
        console.error("Unable to load policy statement mapping:", error);
      }
    };

    loadPolicyStatements();

    return () => {
      cancelled = true;
    };
  }, [data.policyId, hasData]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="absolute top-0 right-0 z-20 print:hidden p-0 m-0">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent text-gray-600 shadow-none hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
          title="Print page"
          aria-label="Print page"
        >
          <Printer className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto w-full max-w-7xl">
        <div className="space-y-4">
        <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review SoD Policy</h1>
              <p className="mt-1 text-xs text-gray-600">
                Review policy details before making updates.
              </p>
            </div>
            {hasData && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shrink-0">
                {data.policyId || "Policy"}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!hasData ? (
            <p className="text-sm text-gray-600">
              No policy selected. Please use the View action from the SoD Policy tab.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Policy ID
                  </p>
                  <p className="text-xs font-medium text-gray-900">{data.policyId || "-"}</p>
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
                    Mitigating Controls
                  </p>
                  <p className="text-xs font-medium text-gray-900 whitespace-pre-wrap">
                    {data.riskDefinition || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    Business Process
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

              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Policy Statement Mapping
                  </p>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {policyStatements.length} Rows
                  </span>
                </div>
                {policyStatements.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-700">
                    No policy statement mapping found for this policy.
                  </p>
                ) : (
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {/* <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Policy
                          </th> */}
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Statement_Type
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Rule
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Entitlements
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {policyStatements.map((row) => {
                          const entitlements = Array.isArray(row.entitlements)
                            ? row.entitlements
                            : [];
                          return (
                          <tr key={`${row.policyId}-${row.statementType}-${row.ruleId}`}>
                            {/* <td className="px-3 py-2 text-xs text-gray-900">
                              {data.name ? `${row.policyId} - ${data.name}` : row.policyId}
                            </td> */}
                            <td className="px-3 py-2 text-xs text-gray-900">{row.statementType}</td>
                            <td className="px-3 py-2 text-xs text-gray-900">
                              {row.ruleName ? `${row.ruleId} - ${row.ruleName}` : row.ruleId}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-900">
                              {entitlements.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {entitlements.map((entitlement) => (
                                    <span
                                      key={`${row.policyId}-${row.ruleId}-${entitlement}`}
                                      className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800"
                                    >
                                      {entitlement}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        )})}
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
    </div>
  );
}
