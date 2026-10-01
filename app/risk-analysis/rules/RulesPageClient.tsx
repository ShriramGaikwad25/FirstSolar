"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listRulesets,
  listRules,
  toggleRuleStatus,
  getRuleDetail,
  upsertRuleV2,
} from "@/lib/api/rm";
import { useLookup } from "@/hooks/useLookup";
import type { RmLookupValue } from "@/lib/api/rm";
import type { RuleListRow } from "@/types/rm-rules";
import type { RmRuleset } from "@/types/rm-dashboard";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { Pencil, Eye, Plus, Copy, Search, ListChecks } from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  RowClassParams,
} from "ag-grid-enterprise";
import CustomPagination from "@/components/agTable/CustomPagination";
import { RuleDetailModal } from "./RuleDetailModal";
import RuleBuilder from "./RuleBuilder";

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
  const [copyFrom, setCopyFrom] = useState<null | { id: number; code: string; name: string }>(
    null
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const totalPages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredRules.length / pageSize));
  // Filtering can shrink the list below the current page; clamp instead of resetting in an effect.
  const page = Math.min(currentPage, totalPages);
  const paginatedRules = useMemo(() => {
    if (pageSize === "all") return filteredRules;
    const start = (page - 1) * pageSize;
    return filteredRules.slice(start, start + pageSize);
  }, [filteredRules, page, pageSize]);

  const openRule = (id: number, edit: boolean) => {
    setOpenRuleId(id);
    setEditMode(edit);
    setCreating(false);
  };

  const iconButton =
    "inline-flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-blue-600";

  const columnDefs = useMemo<ColDef<RuleListRow>[]>(
    () => [
      {
        headerName: "Code",
        field: "rule_code",
        flex: 1,
        minWidth: 130,
        tooltipField: "rule_code",
        cellRenderer: (p: ICellRendererParams<RuleListRow>) =>
          p.data ? (
            <button
              type="button"
              className="truncate text-left font-medium text-blue-600 hover:underline focus:outline-none"
              onClick={() => openRule(p.data!.rule_id, false)}
            >
              {p.value}
            </button>
          ) : null,
      },
      {
        headerName: "Name",
        field: "rule_name",
        flex: 2,
        minWidth: 200,
        tooltipField: "rule_name",
      },
      {
        headerName: "Type",
        field: "rule_type",
        width: 130,
        valueGetter: (p) => (p.data ? lookupName(ruleTypes.data, p.data.rule_type) : ""),
        cellRenderer: (p: ICellRendererParams<RuleListRow>) =>
          p.data ? (
            <Badge label={p.value} color={lookupColor(ruleTypes.data, p.data.rule_type)} />
          ) : null,
      },
      {
        headerName: "Severity",
        field: "severity",
        width: 125,
        valueGetter: (p) => (p.data ? lookupName(severities.data, p.data.severity) : ""),
        cellRenderer: (p: ICellRendererParams<RuleListRow>) =>
          p.data ? (
            <Badge label={p.value} color={lookupColor(severities.data, p.data.severity)} />
          ) : null,
      },
      {
        headerName: "Risk",
        field: "risk_score",
        width: 90,
        valueGetter: (p) => p.data?.risk_score ?? 0,
        cellClass: "tabular-nums",
      },
      {
        headerName: "Functions (A / B)",
        colId: "functions",
        width: 200,
        sortable: false,
        headerTooltip: "Functions on side A / side B of the rule",
        valueGetter: (p) => {
          const conds = p.data?.conditions ?? [];
          const a = conds.filter((c) => c.condition_side === "A").length;
          const b = conds.filter((c) => c.condition_side === "B").length;
          return `${a} / ${b}`;
        },
        cellClass: "tabular-nums text-gray-600",
      },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        valueGetter: (p) => (p.data ? lookupName(statuses.data, p.data.status) : ""),
        cellRenderer: (p: ICellRendererParams<RuleListRow>) =>
          p.data ? (
            <Badge label={p.value} color={lookupColor(statuses.data, p.data.status)} />
          ) : null,
      },
      {
        headerName: "Actions",
        colId: "actions",
        width: 210,
        sortable: false,
        suppressHeaderMenuButton: true,
        resizable: false,
        cellRenderer: (p: ICellRendererParams<RuleListRow>) => {
          const r = p.data;
          if (!r) return null;
          const active = r.status === "ACTIVE";
          return (
            <div className="flex items-center gap-1.5">
              <button type="button" className={iconButton} title="View" onClick={() => openRule(r.rule_id, false)}>
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={iconButton} title="Edit" onClick={() => openRule(r.rule_id, true)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={iconButton}
                title="Copy"
                onClick={() => setCopyFrom({ id: r.rule_id, code: r.rule_code, name: r.rule_name })}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                  active
                    ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                    : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
                disabled={toggle.isPending}
                onClick={() =>
                  void toggle.mutate({ id: r.rule_id, status: active ? "INACTIVE" : "ACTIVE" })
                }
              >
                {active ? "Deactivate" : "Activate"}
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ruleTypes.data, severities.data, statuses.data, toggle.isPending]
  );

  const pagination = (
    <CustomPagination
      totalItems={filteredRules.length}
      currentPage={page}
      totalPages={totalPages}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(n) => {
        setPageSize(n);
        setCurrentPage(1);
      }}
      pageSizeOptions={[10, 20, 50, 100, "all"]}
    />
  );

  const fieldClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-300 pb-2">
        <h1 className="text-2xl font-bold text-blue-950">Rules</h1>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditMode(true);
            setOpenRuleId(null);
          }}
          disabled={!rulesetId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New rule
        </button>
      </div>

      {/* Search and filters */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Ruleset</label>
            <select
              className={fieldClass}
              value={rulesetId ?? ""}
              onChange={(e) => {
                setRulesetId(Number(e.target.value) || null);
                setCurrentPage(1);
              }}
            >
              {activeRulesets.map((r) => (
                <option key={r.ruleset_id} value={r.ruleset_id}>
                  {r.ruleset_name ?? r.ruleset_code}
                </option>
              ))}
            </select>
          </div>
          <div className="relative w-72 shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <Search className="absolute left-3 top-9 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              className={`${fieldClass} pl-9`}
              placeholder="Rule code or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
            <select
              className={fieldClass}
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Any severity</option>
              {severities.data?.map((s) => (
                <option key={s.value_code} value={s.value_code}>
                  {s.value_name}
                </option>
              ))}
            </select>
          </div>
          <span className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
            <ListChecks className="h-4 w-4" />
            Rules: <span className="text-blue-900">{filteredRules.length}</span>
          </span>
          {(search || severity) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSeverity("");
              }}
              className="h-[38px] shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {rules.isError && (
        <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading rules</p>
          <p className="text-sm">
            {rules.error instanceof Error ? rules.error.message : String(rules.error)}
          </p>
        </div>
      )}

      {/* Rules table (AG Grid) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="mb-1 border-b border-gray-100">{pagination}</div>
        <div className="ag-theme-quartz risk-analysis-grid w-full" style={{ width: "100%", minWidth: 0 }}>
          <AgGridReact
            rowData={paginatedRules}
            columnDefs={columnDefs}
            getRowId={(p: GetRowIdParams<RuleListRow>) => String(p.data.rule_id)}
            rowClassRules={{
              "risk-analysis-row-striped": (p: RowClassParams<RuleListRow>) =>
                (p.node.rowIndex ?? 0) % 2 === 1,
            }}
            domLayout="autoHeight"
            pagination={false}
            headerHeight={44}
            rowHeight={48}
            tooltipShowDelay={300}
            defaultColDef={{
              sortable: true,
              filter: false,
              resizable: true,
              suppressSizeToFit: true,
              // Never clip a column title: wrap it and grow the header row instead.
              wrapHeaderText: true,
              autoHeaderHeight: true,
            }}
            loading={rules.isLoading || rulesets.isLoading}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No rules found.</span>`}
          />
        </div>
        <div className="mt-1">{pagination}</div>
      </div>

      {/* label-first single-screen builder for create + edit */}
      {(creating || (openRuleId !== null && editMode)) && rulesetId != null && (
        <RuleBuilder
          ruleId={creating ? null : openRuleId}
          rulesetId={rulesetId}
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
        />
      )}

      {/* read-only detail viewer (tabs) */}
      {openRuleId !== null && !editMode && !creating && rulesetId != null && (
        <RuleDetailModal
          open
          ruleId={openRuleId}
          creating={false}
          rulesetId={rulesetId}
          editMode={false}
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
          onToggleEdit={() => setEditMode(true)}
        />
      )}
      {copyFrom && rulesetId != null && (
        <CopyRuleModal
          sourceId={copyFrom.id}
          sourceCode={copyFrom.code}
          sourceName={copyFrom.name}
          sourceRulesetId={rulesetId}
          rulesets={activeRulesets}
          onClose={() => setCopyFrom(null)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ["rules"] });
            setCopyFrom(null);
          }}
        />
      )}
    </div>
  );
}

// Copy modal — duplicate a rule (functions, user conditions, scoring) under a
// new code, into the same ruleset or another one. There is no server-side
// rule copy, so we read the rule detail and upsert it as a new rule.
function CopyRuleModal({
  sourceId,
  sourceCode,
  sourceName,
  sourceRulesetId,
  rulesets,
  onClose,
  onDone,
}: {
  sourceId: number;
  sourceCode: string;
  sourceName: string;
  sourceRulesetId: number;
  rulesets: RmRuleset[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState(`${sourceCode}_COPY`);
  const [name, setName] = useState(sourceName ? `${sourceName} (copy)` : "");
  const [targetRulesetId, setTargetRulesetId] = useState(sourceRulesetId);
  const [inactive, setInactive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState("");

  const submit = async () => {
    const newCode = code.trim();
    setBusy(true);
    setErr("");
    setResult("");
    try {
      // The upsert is keyed on ruleset + rule code, so reusing an existing
      // code would overwrite that rule instead of creating a copy.
      const existing = (await listRules(targetRulesetId, { page: 1, pageSize: 1000 })).data ?? [];
      if (existing.some((r) => String(r.rule_code ?? "").toLowerCase() === newCode.toLowerCase())) {
        throw new Error(`Rule code ${newCode} already exists in the target ruleset.`);
      }
      const { data: src } = await getRuleDetail(sourceId);
      if (!src) throw new Error("Source rule not found");
      await upsertRuleV2({
        ruleset_id: targetRulesetId,
        rule_code: newCode,
        rule_type: src.rule_type,
        severity: src.severity,
        risk_score: src.risk_score,
        scope_enforcement: src.scope_enforcement,
        rule_name: name.trim() || newCode,
        description: src.description,
        remediation: src.remediation_guidance,
        side_a_function_ids: (src.functions ?? [])
          .filter((f) => f.condition_side === "A")
          .map((f) => f.function_id),
        side_b_function_ids: (src.functions ?? [])
          .filter((f) => f.condition_side === "B")
          .map((f) => f.function_id),
        user_conditions: src.user_conditions ?? [],
        status: inactive ? "INACTIVE" : src.status,
      });
      setResult(`Created ${newCode}.`);
      setTimeout(onDone, 900);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`Copy rule — ${sourceCode}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy || !code.trim()}
            onClick={() => void submit()}
          >
            <Copy className="h-3.5 w-3.5" />
            {busy ? "Copying…" : "Create copy"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">New rule code</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">New rule name</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={name}
            placeholder={code}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Target ruleset</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={targetRulesetId}
            onChange={(e) => setTargetRulesetId(Number(e.target.value))}
          >
            {rulesets.map((r) => (
              <option key={r.ruleset_id} value={r.ruleset_id}>
                {r.ruleset_name ?? r.ruleset_code}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={inactive}
            onChange={(e) => setInactive(e.target.checked)}
          />
          <span>
            Create as <b>inactive</b> — avoids duplicate violations until you&apos;ve reviewed
            the copy.
          </span>
        </label>
        {err && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}
        {result && <p className="text-[13px] text-green-600">{result}</p>}
      </div>
    </Modal>
  );
}
