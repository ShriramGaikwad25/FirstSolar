"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listRulesets, listRules, toggleRuleStatus } from "@/lib/api/rm";
import { useLookup } from "@/hooks/useLookup";
import type { RmLookupValue } from "@/lib/api/rm";
import type { RuleListRow } from "@/types/rm-rules";
import Badge from "@/components/Badge";
import { Pencil, Eye, Plus } from "lucide-react";
import { RuleDetailModal } from "./RuleDetailModal";

export default function RulesPageClient() {
  const qc = useQueryClient();
  const [rulesetId, setRulesetId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");

  const severities = useLookup("RULE_SEVERITY");
  const statuses = useLookup("RULE_STATUS");
  const ruleTypes = useLookup("RULE_TYPE");

  const rulesets = useQuery({
    queryKey: ["rulesets-active"],
    queryFn: async () => (await listRulesets("ACTIVE", 1, 200)).data ?? [],
  });

  const activeRulesets = useMemo(
    () =>
      (rulesets.data ?? []).filter(
        (r) => r.status == null || r.status === "" || r.status === "ACTIVE"
      ),
    [rulesets.data]
  );

  const rules = useQuery({
    enabled: rulesetId != null,
    queryKey: ["rules", rulesetId],
    queryFn: async () => (await listRules(rulesetId!, { page: 1, pageSize: 200 })).data ?? [],
  });

  const filteredRules = useMemo(() => {
    let rows = rules.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.rule_code ?? "").toLowerCase().includes(q) ||
          String(r.rule_name ?? "").toLowerCase().includes(q)
      );
    }
    if (severity) {
      rows = rows.filter((r) => r.severity === severity);
    }
    return rows;
  }, [rules.data, search, severity]);

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => toggleRuleStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rules"] });
    },
  });

  const firstRuleset = activeRulesets[0];
  useEffect(() => {
    if (firstRuleset && rulesetId == null) setRulesetId(firstRuleset.ruleset_id);
  }, [firstRuleset, rulesetId]);

  const lookupColor = (arr: RmLookupValue[] | undefined, code: string) =>
    arr?.find((x) => x.value_code === code)?.color_hex;
  const lookupName = (arr: RmLookupValue[] | undefined, code: string) =>
    arr?.find((x) => x.value_code === code)?.value_name ?? code;

  const [openRuleId, setOpenRuleId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rules</h1>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditMode(true);
            setOpenRuleId(null);
          }}
          disabled={!rulesetId}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New rule
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-3 flex flex-col sm:flex-row flex-wrap gap-2 border-b border-gray-100">
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[200px]"
            value={rulesetId ?? ""}
            onChange={(e) => setRulesetId(Number(e.target.value) || null)}
          >
            {activeRulesets.map((r) => (
              <option key={r.ruleset_id} value={r.ruleset_id}>
                {r.ruleset_name ?? r.ruleset_code}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[200px]"
            placeholder="Search rule code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[180px]"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">Any severity</option>
            {severities.data?.map((s) => (
              <option key={s.value_code} value={s.value_code}>
                {s.value_name}
              </option>
            ))}
          </select>
        </div>

        {rules.isLoading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
        {rules.isError && (
          <div className="p-4 text-sm text-red-600">
            {rules.error instanceof Error ? rules.error.message : String(rules.error)}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[22%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Name</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">Severity</th>
                <th className="py-2.5 px-3 font-medium text-center">Risk</th>
                <th className="py-2.5 px-3 font-medium text-center">Functions</th>
                <th className="py-2.5 px-3 font-medium text-center">User conds</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((r: RuleListRow) => {
                const condA = (r.conditions ?? []).filter((c) => c.condition_side === "A").length;
                const condB = (r.conditions ?? []).filter((c) => c.condition_side === "B").length;
                return (
                  <tr key={r.rule_id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-3 font-semibold text-gray-900 truncate">{r.rule_code}</td>
                    <td className="py-2.5 px-3 text-gray-800 truncate">{r.rule_name}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={lookupName(ruleTypes.data, r.rule_type)}
                        color={lookupColor(ruleTypes.data, r.rule_type)}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={lookupName(severities.data, r.severity)}
                        color={lookupColor(severities.data, r.severity)}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{r.risk_score ?? 0}</td>
                    <td className="py-2.5 px-3 text-center text-xs text-slate-600 tabular-nums">
                      {condA} / {condB}
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-slate-500">—</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={lookupName(statuses.data, r.status)}
                        color={lookupColor(statuses.data, r.status)}
                      />
                    </td>
                    <td className="py-2.5 pl-3 pr-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center justify-center rounded border border-gray-200 p-1.5 hover:bg-gray-50"
                          title="View"
                          onClick={() => {
                            setOpenRuleId(r.rule_id);
                            setEditMode(false);
                            setCreating(false);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center justify-center rounded border border-gray-200 p-1.5 hover:bg-gray-50"
                          title="Edit"
                          onClick={() => {
                            setOpenRuleId(r.rule_id);
                            setEditMode(true);
                            setCreating(false);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 whitespace-nowrap"
                          onClick={() =>
                            void toggle.mutate({
                              id: r.rule_id,
                              status: r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                        >
                          {r.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(openRuleId !== null || creating) && rulesetId != null && (
        <RuleDetailModal
          open
          ruleId={openRuleId}
          creating={creating}
          rulesetId={rulesetId}
          editMode={editMode}
          onClose={() => {
            setOpenRuleId(null);
            setEditMode(false);
            setCreating(false);
          }}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["rules"] });
            setOpenRuleId(null);
            setEditMode(false);
            setCreating(false);
          }}
          onToggleEdit={() => setEditMode((e) => !e)}
        />
      )}
    </div>
  );
}
