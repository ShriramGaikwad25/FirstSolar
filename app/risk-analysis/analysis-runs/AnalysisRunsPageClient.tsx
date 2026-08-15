"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listAnalysisRuns, listRulesets, triggerAnalysis } from "@/lib/api/rm";
import type { AnalysisRunListRow } from "@/types/rm-analysis-runs";
import type { RmRuleset } from "@/types/rm-dashboard";
import { useLookup } from "@/hooks/useLookup";
import Badge from "@/components/Badge";
import { FileSearch, Play } from "lucide-react";

const PAGE_SIZE = 50;

export default function AnalysisRunsPageClient() {
  const qc = useQueryClient();
  const [rulesetId, setRulesetId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const runStatus = useLookup("RUN_STATUS");

  const rulesets = useQuery({
    queryKey: ["rulesets-active", "analysis-runs"],
    queryFn: async () => {
      const { data } = await listRulesets("ACTIVE", 1, 500);
      const rows = data ?? [];
      return rows.filter(
        (r: RmRuleset) => r.status == null || r.status === "" || r.status === "ACTIVE"
      );
    },
  });

  const runs = useQuery({
    queryKey: ["analysis-runs", page, PAGE_SIZE],
    queryFn: async () => (await listAnalysisRuns(page, PAGE_SIZE)).data ?? [],
    refetchInterval: 15_000,
  });

  const displayRows = useMemo(() => {
    const raw = runs.data ?? [];
    if (rulesetId == null) return raw;
    const anyId = raw.some((r) => r.ruleset_id != null);
    if (!anyId) return raw;
    return raw.filter((r) => r.ruleset_id === rulesetId);
  }, [runs.data, rulesetId]);

  const trigger = useMutation({
    mutationFn: async (rid: number) => triggerAnalysis(rid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["analysis-runs"] });
    },
  });

  const lk = (c: string) => runStatus.data?.find((x) => x.value_code === c);

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSearch className="h-6 w-6 text-slate-600 shrink-0" />
          Analysis runs
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[200px]"
            value={rulesetId ?? ""}
            onChange={(e) => {
              setRulesetId(e.target.value ? Number(e.target.value) : null);
              setPage(1);
            }}
          >
            <option value="">All rulesets</option>
            {rulesets.data?.map((r) => (
              <option key={r.ruleset_id} value={r.ruleset_id}>
                {r.ruleset_code}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
            disabled={!rulesetId || trigger.isPending}
            onClick={() => rulesetId && void trigger.mutate(rulesetId)}
          >
            <Play className="h-3.5 w-3.5" />
            Run analysis
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {rulesets.isLoading && <div className="p-4 text-sm text-slate-500">Loading rulesets…</div>}
        {runs.isLoading && <div className="p-4 text-sm text-slate-500">Loading runs…</div>}
        {runs.isError && (
          <div className="p-4 text-sm text-red-600">
            {runs.error instanceof Error ? runs.error.message : String(runs.error)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[27%]" />
              <col className="w-[27%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Run</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-center">Violations</th>
                <th className="py-2.5 px-3 font-medium">Started</th>
                <th className="py-2.5 px-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r: AnalysisRunListRow) => {
                const st = lk(r.run_status);
                return (
                  <tr key={r.run_id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-3 font-medium tabular-nums">#{r.run_id}</td>
                    <td className="py-2.5 px-3 text-slate-800 truncate">{r.run_type}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={st?.value_name ?? r.run_status}
                        color={st?.color_hex ?? "#64748b"}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{r.total_violations}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!runs.isLoading && !displayRows.length && (
          <div className="p-8 text-center text-slate-500 text-sm">No analysis runs for this view.</div>
        )}

        {!runs.isLoading && runs.data && (
          <div className="flex flex-wrap items-center gap-2 p-3 border-t border-gray-100 text-sm text-slate-700">
            <span>Page {page}</span>
            <button
              type="button"
              className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={runs.data.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
            <span className="text-slate-500 text-xs">({PAGE_SIZE} per request)</span>
          </div>
        )}
        {trigger.isError && (
          <div className="p-3 text-sm text-red-600 border-t border-gray-100">
            {(trigger.error as Error)?.message ?? String(trigger.error)}
          </div>
        )}
      </div>
    </div>
  );
}
