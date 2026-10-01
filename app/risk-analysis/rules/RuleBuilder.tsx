"use client";

// RuleBuilder — single-screen, label-first SoD rule authoring.
//
// Replaces the tabbed Side A / Side B editor for create & edit:
//   * starts from the business LABEL, not jargon — code auto-derives
//   * the rule reads as a sentence: "Flag any user who can [A] and also [B]"
//   * inline function pickers (search-as-you-type, chips) — no tab hopping
//   * severity / scope / type as one visual row, risk auto-suggested
//   * user conditions, description, ruleset membership as collapsibles
// Saves through upsertRuleV2 + setRuleRulesets + setRuleScopePairs.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRuleDetail,
  upsertRuleV2,
  searchFunctions,
  listUserAttributes,
  listRulesets,
  listRuleRulesets,
  setRuleRulesets,
  listScopeValues,
  getRuleScopePairs,
  setRuleScopePairs,
} from "@/lib/api/rm";
import { useLookup } from "@/hooks/useLookup";
import type { FunctionRow, RuleScopePair, RuleUserCondition } from "@/types/rm-rules";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { X, Save, Search, Plus, Trash2, ShieldAlert } from "lucide-react";

type FnChip = {
  function_id: number;
  function_code: string;
  function_name?: string;
  system_type: string;
};

type RuleType = "SOD" | "SENSITIVE_ACCESS";

type Props = {
  ruleId: number | null; // null = create
  rulesetId: number; // home ruleset for new rules
  onClose: () => void;
  onSaved: () => void;
};

const SEV_RISK: Record<string, number> = { LOW: 30, MEDIUM: 60, HIGH: 85, CRITICAL: 95 };

const DEFAULT_SCOPE_ENFORCEMENTS = [
  { value_code: "SAME_SCOPE", value_name: "Only within the same org scope" },
  { value_code: "ALWAYS", value_name: "Anywhere (ignore data scope)" },
  { value_code: "CROSS_SCOPE", value_name: "Only across different scopes" },
  { value_code: "SCOPE_PAIR", value_name: "Specific scope combinations" },
];

const inputCls = "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm";
const btnCls =
  "inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const summaryCls = "cursor-pointer text-[13px] font-semibold text-slate-700";

function codeFromLabel(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export default function RuleBuilder({ ruleId, rulesetId, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const severities = useLookup("RULE_SEVERITY");
  const scopeEnfs = useLookup("SCOPE_ENFORCEMENT");

  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [ruleType, setRuleType] = useState<RuleType>("SOD");
  const [severity, setSeverity] = useState("HIGH");
  const [risk, setRisk] = useState(85);
  const [riskTouched, setRiskTouched] = useState(false);
  const [scopeEnf, setScopeEnf] = useState("SAME_SCOPE");
  const [status, setStatus] = useState("ACTIVE");
  const [sideA, setSideA] = useState<FnChip[]>([]);
  const [sideB, setSideB] = useState<FnChip[]>([]);
  const [conds, setConds] = useState<RuleUserCondition[]>([]);
  const [description, setDescription] = useState("");
  const [remediation, setRemediation] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]); // extra (non-home) rulesets
  const [homeId, setHomeId] = useState<number>(rulesetId);
  const [scopePairs, setScopePairs] = useState<RuleScopePair[]>([]);

  // ---------------- load when editing ----------------
  const detail = useQuery({
    enabled: ruleId !== null,
    queryKey: ["rule-detail", ruleId],
    queryFn: async () => {
      const { data } = await getRuleDetail(ruleId!);
      if (!data) throw new Error("Rule not found");
      return data;
    },
  });
  const memberships = useQuery({
    enabled: ruleId !== null,
    queryKey: ["rule-rulesets", ruleId],
    queryFn: async () => (await listRuleRulesets(ruleId!)).data ?? [],
  });
  const allRulesets = useQuery({
    queryKey: ["rulesets-active"],
    queryFn: async () => (await listRulesets("ACTIVE", 1, 200)).data ?? [],
  });
  const attrs = useQuery({
    queryKey: ["user-attrs-catalog"],
    queryFn: async () => listUserAttributes(),
  });
  const scopeValues = useQuery({
    queryKey: ["scope-values"],
    queryFn: async () => (await listScopeValues()).data ?? [],
  });
  const existingPairs = useQuery({
    enabled: ruleId !== null,
    queryKey: ["rule-scope-pairs", ruleId],
    queryFn: async () => (await getRuleScopePairs(ruleId!)).data ?? [],
  });

  useEffect(() => {
    if (existingPairs.data) setScopePairs(existingPairs.data);
  }, [existingPairs.data]);

  useEffect(() => {
    const d = detail.data;
    if (!d) return;
    setLabel(d.rule_name ?? "");
    setCode(d.rule_code);
    setCodeTouched(true);
    setRuleType(d.rule_type === "SENSITIVE_ACCESS" ? "SENSITIVE_ACCESS" : "SOD");
    setSeverity(d.severity);
    setRisk(d.risk_score);
    setRiskTouched(true);
    setScopeEnf(d.scope_enforcement);
    setStatus(d.status);
    setDescription(d.description ?? "");
    setRemediation(d.remediation_guidance ?? "");
    setHomeId(d.ruleset_id || rulesetId);
    setSideA(d.functions.filter((f) => f.condition_side === "A"));
    setSideB(d.functions.filter((f) => f.condition_side === "B"));
    setConds(d.user_conditions ?? []);
  }, [detail.data, rulesetId]);

  useEffect(() => {
    if (memberships.data) {
      setMemberIds(memberships.data.filter((m) => !m.is_home).map((m) => m.ruleset_id));
    }
  }, [memberships.data]);

  // Auto-derive code + risk — only while CREATING. In edit mode the loaded
  // values are authoritative and must never be overwritten by these effects.
  useEffect(() => {
    if (ruleId === null && !codeTouched) setCode(codeFromLabel(label));
  }, [label, codeTouched, ruleId]);
  useEffect(() => {
    if (ruleId === null && !riskTouched) setRisk(SEV_RISK[severity] ?? 50);
  }, [severity, riskTouched, ruleId]);

  // ---------------- save ----------------
  const save = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Give the rule a name");
      if (!code.trim()) throw new Error("Rule code is required");
      if (sideA.length === 0) throw new Error("Pick at least one function for the first part");
      if (ruleType === "SOD" && sideB.length === 0)
        throw new Error(
          'An SoD rule needs the second ("and also") part — or switch to Sensitive access'
        );

      const r = await upsertRuleV2({
        ruleset_id: homeId,
        rule_code: code.trim(),
        rule_type: ruleType,
        severity,
        risk_score: risk,
        scope_enforcement: scopeEnf,
        rule_name: label.trim(),
        description: description || undefined,
        remediation: remediation || undefined,
        side_a_function_ids: sideA.map((f) => f.function_id),
        side_b_function_ids: ruleType === "SOD" ? sideB.map((f) => f.function_id) : [],
        user_conditions: conds,
        status,
      });
      const saved = r.data as { success?: boolean; error?: string; rule_id?: unknown } | null;
      if (saved && saved.success === false) throw new Error(saved.error ?? "Save failed");
      const savedId = Number(saved?.rule_id) || ruleId;
      if (savedId) {
        await setRuleRulesets(savedId, memberIds);
        // pair list only meaningful for SCOPE_PAIR; clearing otherwise keeps data tidy
        await setRuleScopePairs(savedId, scopeEnf === "SCOPE_PAIR" ? scopePairs : []);
      }
      return r;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rules"] });
      void qc.invalidateQueries({ queryKey: ["rule-detail", ruleId] });
      void qc.invalidateQueries({ queryKey: ["rule-rulesets", ruleId] });
      void qc.invalidateQueries({ queryKey: ["rule-scope-pairs", ruleId] });
      onSaved();
    },
  });

  const sentence = useMemo(() => {
    const list = (fns: FnChip[]) => fns.map((f) => f.function_name || f.function_code).join("” or “");
    if (sideA.length === 0) return "Pick the access this rule should catch…";
    if (ruleType === "SENSITIVE_ACCESS") return `Flag any user who can “${list(sideA)}”.`;
    if (sideB.length === 0) return `Flag any user who can “${list(sideA)}” … and also ?`;
    return `Flag any user who can “${list(sideA)}” and can also “${list(sideB)}”.`;
  }, [sideA, sideB, ruleType]);

  const operators = attrs.data?.operators ?? ["EQUALS", "NOT_EQUALS", "IN"];
  const attrList = attrs.data?.data ?? [];
  const scopeOptions = scopeValues.data ?? [];
  const scopeEnfOptions = scopeEnfs.data?.length ? scopeEnfs.data : DEFAULT_SCOPE_ENFORCEMENTS;

  const pickScope = (i: number, side: "a" | "b", key: string) => {
    const [st, id] = key.split("|");
    const sv = scopeOptions.find((v) => v.scope_type === st && v.scope_id === id);
    setScopePairs(
      scopePairs.map((x, j) =>
        j !== i
          ? x
          : side === "a"
            ? { ...x, a_scope_type: st, a_scope_id: id, a_scope_name: sv?.scope_name }
            : { ...x, b_scope_type: st, b_scope_id: id, b_scope_name: sv?.scope_name }
      )
    );
  };

  if (ruleId !== null && detail.isLoading) {
    return (
      <Modal open onClose={onClose} extraWide>
        <div className="p-4 text-slate-600">Loading…</div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      extraWide
      footer={
        <>
          {save.isError ? (
            <div className="flex-1 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm text-red-800">
              {(save.error as Error).message}
            </div>
          ) : (
            <div className="flex-1 self-center text-xs text-slate-500">{sentence}</div>
          )}
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
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving…" : "Save rule"}
          </button>
        </>
      }
    >
      {/* header */}
      <div className="-mt-1 mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <ShieldAlert className="h-[18px] w-[18px] text-blue-600" />
          {ruleId === null ? "New rule" : `Edit ${code}`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex items-center justify-center rounded border border-gray-200 p-1.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {detail.isError && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm text-red-800">
          {(detail.error as Error).message}
        </div>
      )}

      {/* 1 — label first */}
      <label htmlFor="rb-label" className="mb-1 block text-sm font-medium text-gray-800">
        What should this rule be called?
      </label>
      <input
        id="rb-label"
        autoFocus
        className={`${inputCls} mb-1.5 w-full text-base font-semibold`}
        placeholder="e.g. Create Supplier vs Pay Supplier"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">code</span>
        <input
          className={`${inputCls} w-full max-w-[300px] font-mono text-xs`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeTouched(true);
          }}
        />
        <span className="text-[11px] text-slate-500">
          (auto-generated from the name — edit if needed)
        </span>
      </div>

      {/* 2 — the sentence */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="text-sm">Flag any user who can…</span>
          <div className="ml-auto">
            <TypeToggle value={ruleType} onChange={setRuleType} />
          </div>
        </div>
        <FunctionChips
          value={sideA}
          onChange={setSideA}
          exclude={sideB}
          placeholder="search a business function or role…"
        />
        {ruleType === "SOD" && (
          <>
            <div className="mb-2 mt-3 text-sm">
              …and can <b>also</b>…
            </div>
            <FunctionChips
              value={sideB}
              onChange={setSideB}
              exclude={sideA}
              placeholder="search the conflicting function…"
            />
          </>
        )}
        <div className="mt-3 text-[13px] italic text-slate-700">{sentence}</div>
      </div>

      {/* 3 — risk row */}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-3">
        <div>
          <div className="mb-1 text-[11px] text-slate-500">SEVERITY</div>
          <div className="flex flex-wrap gap-1">
            {(severities.data ?? []).map((s) => {
              const color = s.color_hex || "#2563eb";
              const active = severity === s.value_code;
              return (
                <button
                  key={s.value_code}
                  type="button"
                  onClick={() => setSeverity(s.value_code)}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium"
                  style={{
                    background: active ? color : "#fff",
                    color: active ? "#fff" : color,
                    borderColor: color,
                  }}
                >
                  {s.value_name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-500">RISK SCORE</div>
          <input
            type="number"
            className={`${inputCls} w-[90px]`}
            value={risk}
            min={0}
            max={100}
            onChange={(e) => {
              setRisk(Number(e.target.value));
              setRiskTouched(true);
            }}
          />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-500">WHERE IT APPLIES</div>
          <select className={inputCls} value={scopeEnf} onChange={(e) => setScopeEnf(e.target.value)}>
            {scopeEnfOptions.map((s) => (
              <option key={s.value_code} value={s.value_code}>
                {s.value_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-500">STATUS</div>
          <button
            type="button"
            className={btnCls}
            onClick={() => setStatus(status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
          >
            <Badge label={status} color={status === "ACTIVE" ? "#16a34a" : "#64748b"} />
          </button>
        </div>
      </div>

      {/* 3b — scope-pair picker (SCOPE_PAIR only) */}
      {scopeEnf === "SCOPE_PAIR" && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3.5">
          <div className="mb-1 text-[13px] font-semibold text-blue-800">
            Which scope combinations conflict?
          </div>
          <div className="mb-2.5 text-xs text-slate-500">
            Only the combinations listed here fire. “⇄ both ways” also matches the reverse (first
            part in B, second in A). Unscoped (global) grants match any listed value.
          </div>
          {scopeValues.isError && (
            <div className="mb-2 text-xs text-red-700">{(scopeValues.error as Error).message}</div>
          )}
          {scopePairs.map((p, i) => (
            <div key={i} className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <ScopeSelect
                value={`${p.a_scope_type}|${p.a_scope_id}`}
                options={scopeOptions}
                onChange={(v) => pickScope(i, "a", v)}
              />
              <button
                type="button"
                className={btnCls}
                title={p.symmetric ? "Matches both directions" : "Matches A→B only"}
                onClick={() =>
                  setScopePairs(
                    scopePairs.map((x, j) => (j === i ? { ...x, symmetric: !x.symmetric } : x))
                  )
                }
              >
                {p.symmetric ? "⇄ both ways" : "→ one way"}
              </button>
              <ScopeSelect
                value={`${p.b_scope_type}|${p.b_scope_id}`}
                options={scopeOptions}
                onChange={(v) => pickScope(i, "b", v)}
              />
              <button
                type="button"
                className={btnCls}
                aria-label="Remove pair"
                onClick={() => setScopePairs(scopePairs.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={btnCls}
            disabled={scopeOptions.length === 0}
            onClick={() => {
              const first = scopeOptions[0];
              const second = scopeOptions[1] ?? first;
              if (!first) return;
              setScopePairs([
                ...scopePairs,
                {
                  a_scope_type: first.scope_type,
                  a_scope_id: first.scope_id,
                  a_scope_name: first.scope_name,
                  b_scope_type: second.scope_type,
                  b_scope_id: second.scope_id,
                  b_scope_name: second.scope_name,
                  symmetric: true,
                },
              ]);
            }}
          >
            <Plus className="h-3 w-3" /> Add scope combination
          </button>
          {scopePairs.length === 0 && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              No combinations yet — this rule will never fire until you add at least one.
            </div>
          )}
        </div>
      )}

      {/* 4 — collapsibles */}
      <details className="mb-2.5">
        <summary className={summaryCls}>
          Only for certain users{" "}
          {conds.length > 0 && `(${conds.length} condition${conds.length > 1 ? "s" : ""})`}
        </summary>
        <div className="pl-3 pt-2.5">
          {conds.map((c, i) => (
            <div key={i} className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <select
                className={`${inputCls} w-[180px]`}
                value={c.attribute_name}
                onChange={(e) =>
                  setConds(conds.map((x, j) => (j === i ? { ...x, attribute_name: e.target.value } : x)))
                }
              >
                {attrList.map((a) => (
                  <option key={a.attribute_name} value={a.attribute_name}>
                    {a.display_name || a.attribute_name}
                  </option>
                ))}
              </select>
              <select
                className={`${inputCls} w-[130px]`}
                value={c.operator}
                onChange={(e) =>
                  setConds(conds.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))
                }
              >
                {operators.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <input
                className={`${inputCls} w-[180px]`}
                value={c.attribute_value ?? ""}
                onChange={(e) =>
                  setConds(conds.map((x, j) => (j === i ? { ...x, attribute_value: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className={btnCls}
                aria-label="Remove condition"
                onClick={() => setConds(conds.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={btnCls}
            onClick={() =>
              setConds([
                ...conds,
                {
                  condition_side: "X",
                  logic_op: "AND",
                  attribute_name: attrList[0]?.attribute_name ?? "department",
                  operator: operators[0] ?? "EQUALS",
                  attribute_value: "",
                },
              ])
            }
          >
            <Plus className="h-3 w-3" /> Add user condition
          </button>
        </div>
      </details>

      <details className="mb-2.5">
        <summary className={summaryCls}>Description &amp; remediation</summary>
        <div className="space-y-2 pl-3 pt-2.5">
          <textarea
            className={`${inputCls} w-full`}
            rows={2}
            placeholder="Why this combination is risky…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <textarea
            className={`${inputCls} w-full`}
            rows={2}
            placeholder="How to remediate…"
            value={remediation}
            onChange={(e) => setRemediation(e.target.value)}
          />
        </div>
      </details>

      <details>
        <summary className={summaryCls}>
          Rulesets {memberIds.length > 0 && `(+${memberIds.length} shared)`}
        </summary>
        <div className="pl-3 pt-2.5">
          {(allRulesets.data ?? []).map((rs) => {
            const isHome = rs.ruleset_id === homeId;
            const checked = isHome || memberIds.includes(rs.ruleset_id);
            return (
              <label key={rs.ruleset_id} className="flex items-center gap-1.5 py-0.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isHome}
                  onChange={(e) =>
                    setMemberIds(
                      e.target.checked
                        ? [...memberIds, rs.ruleset_id]
                        : memberIds.filter((id) => id !== rs.ruleset_id)
                    )
                  }
                />
                {rs.ruleset_name ?? rs.ruleset_code}
                {isHome && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    home
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </details>
    </Modal>
  );
}

function ScopeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { scope_type: string; scope_id: string; scope_name: string; in_use?: boolean }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className={`${inputCls} w-full max-w-[240px]`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((v) => (
        <option key={`${v.scope_type}|${v.scope_id}`} value={`${v.scope_type}|${v.scope_id}`}>
          {v.scope_type.replaceAll("_", " ")}: {v.scope_name}
          {v.in_use ? " · in use" : ""}
        </option>
      ))}
    </select>
  );
}

function TypeToggle({ value, onChange }: { value: RuleType; onChange: (v: RuleType) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300">
      {(
        [
          ["SOD", "Toxic combination"],
          ["SENSITIVE_ACCESS", "Sensitive access"],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-xs ${
            value === v ? "bg-blue-600 font-semibold text-white" : "bg-white text-slate-600"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function FunctionChips({
  value,
  onChange,
  exclude,
  placeholder,
}: {
  value: FnChip[];
  onChange: (v: FnChip[]) => void;
  exclude: FnChip[];
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useQuery({
    enabled: q.length >= 1,
    queryKey: ["fn-search", q, 12],
    queryFn: async () => (await searchFunctions(q, undefined, 12)).data ?? [],
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const add = (f: FunctionRow) => {
    if (!value.find((x) => x.function_id === f.function_id)) {
      onChange([
        ...value,
        {
          function_id: f.function_id,
          function_code: f.function_code,
          function_name: f.function_name,
          system_type: f.system_type,
        },
      ]);
    }
    setQ("");
    setOpen(false);
  };

  const takenElsewhere = new Set(exclude.map((f) => f.function_id));

  return (
    <div ref={boxRef} className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white p-1.5">
        {value.map((f) => (
          <span
            key={f.function_id}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800"
          >
            <span className="rounded bg-white/70 px-1 text-[10px] font-semibold">{f.system_type}</span>
            {f.function_name || f.function_code}
            <button
              type="button"
              aria-label={`Remove ${f.function_code}`}
              className="ml-0.5"
              onClick={() => onChange(value.filter((x) => x.function_id !== f.function_id))}
            >
              <X className="h-[11px] w-[11px]" />
            </button>
          </span>
        ))}
        <div className="flex min-w-[200px] flex-1 items-center gap-1">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            placeholder={value.length === 0 ? placeholder : "add another…"}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => q && setOpen(true)}
            className="flex-1 border-none bg-transparent text-[13px] outline-none"
          />
        </div>
      </div>
      {open && q && (
        <div className="absolute left-0 right-0 top-full z-30 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {(results.data ?? []).map((f) => {
            const dup = takenElsewhere.has(f.function_id);
            return (
              <button
                key={f.function_id}
                type="button"
                disabled={dup}
                onClick={() => add(f)}
                className={`block w-full border-b border-slate-100 px-2.5 py-2 text-left ${
                  dup ? "cursor-not-allowed opacity-45" : "hover:bg-slate-50"
                }`}
              >
                <span className="mr-1.5 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
                  {f.system_type}
                </span>
                <b className="text-[13px]">{f.function_name || f.function_code}</b>
                <span className="ml-1.5 text-[11px] text-slate-500">{f.function_code}</span>
                {dup && <span className="text-[11px] text-slate-500"> — already on the other side</span>}
              </button>
            );
          })}
          {!results.isLoading && (results.data ?? []).length === 0 && (
            <div className="p-2.5 text-xs text-slate-500">No functions match “{q}”</div>
          )}
        </div>
      )}
    </div>
  );
}
