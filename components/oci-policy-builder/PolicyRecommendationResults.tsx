"use client";

import { useMemo } from "react";
import {
  parsePolicyRecommendationResponse,
  readPolicyRecommendationConflictRows,
} from "@/lib/policy-recommendation-api";
import type { PolicyIncomingSimulationConflictRow, PolicyIncomingSimulationResult } from "@/types/oci-policy";

const TH =
  "px-4 py-3 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider align-middle bg-slate-100 border-b border-slate-300 whitespace-nowrap";
const TD = "px-4 py-3 text-sm font-normal text-gray-800 align-middle bg-white";

function verdictStyle(verdict: string): string {
  if (verdict === "SAFE_TO_ADD") return "bg-green-100 text-green-800 border-green-200";
  if (verdict.includes("COVERED")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (verdict.includes("DUPLICATE")) return "bg-red-100 text-red-800 border-red-200";
  return "bg-violet-100 text-violet-800 border-violet-200";
}

function categoryStyle(category: string): string {
  const upper = category.toUpperCase();
  if (upper.includes("DUPLICATE")) return "bg-red-100 text-red-800 border-red-200";
  if (upper.includes("REDUNDANT") || upper.startsWith("COVERED")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-violet-100 text-violet-800 border-violet-200";
}

function StructuredRecommendation({
  result,
  conflictRows,
}: {
  result: PolicyIncomingSimulationResult;
  conflictRows: PolicyIncomingSimulationConflictRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Simulation summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={TH}>Incoming statement</th>
                <th className={TH}>Verdicts</th>
                <th className={TH}>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-violet-50/40">
                <td className={`${TD} break-words font-mono text-xs`}>
                  {result.incomingStatement}
                </td>
                <td className={TD}>
                  {result.verdicts.length === 0 ? (
                    <span className="text-xs text-gray-500">—</span>
                  ) : result.verdicts.length === 1 && result.verdicts[0].length > 48 ? (
                    <span className="text-xs leading-relaxed text-gray-800">
                      {result.verdicts[0]}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {result.verdicts.map((verdict) => (
                        <span
                          key={verdict}
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${verdictStyle(verdict)}`}
                        >
                          {verdict}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={`${TD} break-words`}>{result.recommendation}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Conflict details</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            {conflictRows.length === 0
              ? "No conflicting statements found."
              : `${conflictRows.length} related statement${conflictRows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {conflictRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-green-700">
            Safe to add. No conflicts found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={TH}>Category</th>
                  <th className={TH}>Policy</th>
                  <th className={TH}>Statement ID</th>
                  <th className={TH}>Full text</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conflictRows.map((row) => (
                  <tr
                    key={`${row.category}-${row.policy}-${row.statementId}`}
                    className="hover:bg-violet-50/40"
                  >
                    <td className={TD}>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${categoryStyle(row.category)}`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className={`${TD} break-words font-medium`}>{row.policy}</td>
                    <td className={`${TD} break-words font-mono text-xs`}>{row.statementId}</td>
                    <td className={`${TD} break-words`}>{row.fullText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function PolicyRecommendationResults({
  data,
  statement,
}: {
  data: unknown;
  statement?: string;
}) {
  const result = useMemo(
    () => parsePolicyRecommendationResponse(data, statement),
    [data, statement]
  );
  const conflictRows = useMemo(
    () => readPolicyRecommendationConflictRows(data),
    [data]
  );

  if (!result) {
    return (
      <p className="text-sm text-gray-600">
        No simulation summary could be parsed from the API response.
      </p>
    );
  }

  return <StructuredRecommendation result={result} conflictRows={conflictRows} />;
}
