"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitMerge, ShieldCheck, User, Users } from "lucide-react";
import Badge from "@/components/Badge";
import { getRolePairDetail } from "@/lib/api/rm";
import type { RolePairRole, RolePairRule, RolePairTotals } from "@/types/rm-simulation";

const roleLabel = (r: RolePairRole) => (r.app_name ? `${r.entitlement_name} (${r.app_name})` : r.entitlement_name);

/** Risk between two roles, split into what each role triggers alone and what only the combination triggers. */
export default function RolePairBuckets({ entA, entB }: { entA: string; entB: string }) {
  const pair = useQuery({
    queryKey: ["role-pair", entA, entB],
    queryFn: () => getRolePairDetail(entA, entB),
  });

  if (pair.isLoading) return <div className="text-sm text-slate-500">Analyzing pair…</div>;
  if (pair.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        {pair.error instanceof Error ? pair.error.message : String(pair.error)}
      </div>
    );
  }
  const t = pair.data;
  if (!t) return null;

  const buckets: { key: string; title: string; icon: ReactNode; rules: RolePairRule[]; totals: RolePairTotals; accent: string; hint: string }[] = [
    {
      key: "a",
      title: `${roleLabel(t.role_a)} alone`,
      icon: <User className="h-3.5 w-3.5" />,
      rules: t.a_intrinsic,
      totals: t.totals.a_intrinsic,
      accent: "#f59e0b",
      hint: "This role triggers these rules by itself — combining is irrelevant.",
    },
    {
      key: "b",
      title: `${roleLabel(t.role_b)} alone`,
      icon: <User className="h-3.5 w-3.5" />,
      rules: t.b_intrinsic,
      totals: t.totals.b_intrinsic,
      accent: "#f59e0b",
      hint: "This role triggers these rules by itself — combining is irrelevant.",
    },
    {
      key: "combo",
      title: "Combination only",
      icon: <GitMerge className="h-3.5 w-3.5" />,
      rules: t.combination_only,
      totals: t.totals.combination_only,
      accent: "#dc2626",
      hint: "Conflicts that appear only when a user holds both roles — the decisive bucket for role-assignment decisions.",
    },
  ];
  const combinedRisk =
    t.totals.a_intrinsic.total_risk + t.totals.b_intrinsic.total_risk + t.totals.combination_only.total_risk;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-slate-700">
          <Users className="h-3 w-3" /> {roleLabel(t.role_a)} + {roleLabel(t.role_b)}
        </span>
        <span
          className={`rounded px-2 py-1 font-medium ${
            combinedRisk > 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
          }`}
        >
          Combined risk score: {combinedRisk}
        </span>
      </div>

      {buckets.map((b) => (
        <div
          key={b.key}
          className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm"
          style={{ borderLeft: `4px solid ${b.rules.length ? b.accent : "#e2e8f0"}` }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              {b.icon} {b.title}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                {b.totals.count} rule{b.totals.count === 1 ? "" : "s"}
              </span>
            </div>
            {b.totals.total_risk > 0 && (
              <b className="text-sm" style={{ color: b.accent }}>
                risk {b.totals.total_risk}
              </b>
            )}
          </div>
          <div className={`text-xs text-slate-500 ${b.rules.length ? "mb-2.5" : ""}`}>{b.hint}</div>
          {b.rules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                    <th className="p-2">Rule</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Severity</th>
                    <th className="p-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rules.map((r) => (
                    <tr key={r.rule_id} className="border-b border-slate-100">
                      <td className="p-2">
                        <b>{r.rule_code}</b>
                        {r.rule_name && <div className="text-xs text-slate-500">{r.rule_name}</div>}
                      </td>
                      <td className="p-2">
                        <Badge label={r.rule_type} />
                      </td>
                      <td className="p-2">
                        <Badge label={r.severity_name ?? r.severity} color={r.severity_color ?? undefined} />
                      </td>
                      <td className="p-2 font-semibold">{r.risk_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No conflicts in this bucket.</div>
          )}
        </div>
      ))}

      {combinedRisk === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm text-green-900">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-green-600" />
          These two roles can be combined without triggering any active SoD or sensitive-access rule.
        </div>
      )}
    </div>
  );
}
