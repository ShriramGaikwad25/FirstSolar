"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleHelp, Info, Play, Plus, ShieldAlert, ShieldCheck, X } from "lucide-react";
import Badge from "@/components/Badge";
import { checkRequestScoped, listLookupOptions, listScopeValues, searchEntitlements, searchUsers } from "@/lib/api/rm";
import type {
  EntitlementSearchRow,
  ScopedCheckAccessRef,
  ScopedCheckItem,
  ScopedCheckResult,
  ScopeValue,
  UserSearchRow,
} from "@/types/rm-simulation";

type ScopeRow = { type: string; value: string };
type RequestRow = { key: number; ent: EntitlementSearchRow | null; search: string; scopes: ScopeRow[] };

const VERDICTS: Record<string, { color: string; bg: string; label: string; text: string }> = {
  CLEAN: { color: "#16a34a", bg: "#f0fdf4", label: "Clean", text: "No SoD rule would be broken." },
  WARN: { color: "#d97706", bg: "#fffbeb", label: "Warning", text: "Rules would be broken; none at a blocking severity." },
  BLOCK: { color: "#dc2626", bg: "#fef2f2", label: "Block", text: "A rule at a blocking severity would be broken." },
  UNRESOLVED: {
    color: "#475569",
    bg: "#f1f5f9",
    label: "Unresolved",
    text: "Part of the request could not be resolved — do not approve on this result. Anything unresolved was checked as every scope.",
  },
};

const CONFLICT_WITH: Record<string, string> = {
  HELD_ACCESS: "Access the user holds",
  PENDING_REQUEST: "Another open request",
  SAME_REQUEST: "This request",
};

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const btnCls = "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50";

/** Request check with data scope: each requested role counts only in the scopes it is requested for. */
export default function ScopedRequestCheck({ rulesetCode }: { rulesetCode: string | null }) {
  const nextKey = useRef(1);
  const newRow = (): RequestRow => ({ key: nextKey.current++, ent: null, search: "", scopes: [] });
  const [user, setUser] = useState<UserSearchRow | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [rows, setRows] = useState<RequestRow[]>(() => [newRow()]);

  const scopeTypeLookup = useQuery({ queryKey: ["rm-lookup", "SCOPE_TYPE"], queryFn: () => listLookupOptions("SCOPE_TYPE") });
  const scopeTypes = useMemo(
    () => (scopeTypeLookup.data ?? []).filter((o) => o.value_code !== "GLOBAL"),
    [scopeTypeLookup.data]
  );
  const typeLabel = (code?: string | null) =>
    (code && scopeTypes.find((o) => o.value_code === code)?.value_name) || code || "";
  const severities = useQuery({ queryKey: ["rm-lookup", "RULE_SEVERITY"], queryFn: () => listLookupOptions("RULE_SEVERITY") });
  const severity = (code: string) => severities.data?.find((o) => o.value_code === code);
  const scopeValues = useQuery({
    queryKey: ["rm-scope-values"],
    queryFn: async () => (await listScopeValues()).data ?? [],
  });

  const userResults = useQuery({
    enabled: userSearch.trim().length >= 1,
    queryKey: ["scoped-user-search", userSearch.trim()],
    queryFn: async () => (await searchUsers(userSearch.trim(), 15)).data ?? [],
  });

  const accessOf = (r: RequestRow) => (r.ent ? r.ent.entitlementname : r.search.trim());
  const filled = rows.filter((r) => accessOf(r));

  const check = useMutation({
    mutationFn: (): Promise<ScopedCheckResult> =>
      checkRequestScoped({
        user_id: user?.userid ?? null,
        ruleset_codes: rulesetCode ? [rulesetCode] : undefined,
        items: filled.map((r) => ({
          ...(r.ent ? { entitlement_id: r.ent.entitlementid } : { access: accessOf(r) }),
          scopes: r.scopes.filter((s) => s.type && s.value.trim()).map((s) => ({ type: s.type, value: s.value.trim() })),
        })),
      }),
  });

  const updateRow = (key: number, patch: Partial<RequestRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    check.reset();
  };

  return (
    <div>
      <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 p-2.5 text-sm text-slate-700">
        <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Checks a request the way the analysis will see it once granted: each role counts only in the scopes it is
        requested for — business unit, company code, plant, whatever its system grants by. A role requested without a
        scope is checked in every scope. Leave the user empty to check a new hire.
      </div>

      <label className="mb-1 block text-xs font-medium text-slate-600">User (optional)</label>
      {user ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 p-2.5">
          <div>
            <div className="font-semibold text-gray-900">{user.displayname}</div>
            <div className="text-xs text-slate-500">
              {user.username} · {user.title ?? ""} · {user.department ?? ""}
            </div>
          </div>
          <button type="button" className="rounded border border-gray-200 px-2 py-1 text-sm" onClick={() => { setUser(null); check.reset(); }}>
            Change
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <input
            className={inputCls}
            placeholder="Search by name, username, or employee ID — or leave empty for a new hire"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          {userSearch && (
            <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-gray-200">
              {(userResults.data ?? []).map((u) => (
                <button
                  key={u.userid}
                  type="button"
                  className="w-full border-b border-slate-100 px-2 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => { setUser(u); setUserSearch(""); check.reset(); }}
                >
                  <div className="font-semibold">{u.displayname}</div>
                  <div className="text-[11px] text-slate-500">
                    {u.username} — {u.title ?? "—"}, {u.department ?? "—"}
                  </div>
                </button>
              ))}
              {(userResults.data ?? []).length === 0 && !userResults.isLoading && (
                <div className="p-2 text-xs text-slate-500">No matches</div>
              )}
            </div>
          )}
        </div>
      )}

      <label className="mb-1 block text-xs font-medium text-slate-600">Requested access</label>
      <div className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <RequestItem
            key={r.key}
            index={i + 1}
            row={r}
            scopeTypes={scopeTypes}
            scopeValues={scopeValues.data ?? []}
            onChange={(patch) => updateRow(r.key, patch)}
            onRemove={rows.length > 1 ? () => { setRows(rows.filter((x) => x.key !== r.key)); check.reset(); } : undefined}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={btnCls} onClick={() => setRows([...rows, newRow()])}>
          <Plus className="h-3.5 w-3.5" /> Add access
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className={btnCls}
            disabled={check.isPending}
            onClick={() => { setUser(null); setUserSearch(""); setRows([newRow()]); check.reset(); }}
          >
            Reset
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={filled.length === 0 || check.isPending}
            onClick={() => check.mutate()}
          >
            <Play className="h-3.5 w-3.5" /> {check.isPending ? "Checking…" : "Check request"}
          </button>
        </div>
      </div>

      {check.isError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {check.error instanceof Error ? check.error.message : String(check.error)}
        </div>
      )}
      {check.data && (
        <CheckResult
          result={check.data}
          typeLabel={typeLabel}
          severityName={(c) => severity(c)?.value_name ?? c}
          severityColor={(c) => severity(c)?.color_hex ?? undefined}
        />
      )}
    </div>
  );
}

function RequestItem({
  index,
  row,
  scopeTypes,
  scopeValues,
  onChange,
  onRemove,
}: {
  index: number;
  row: RequestRow;
  scopeTypes: { value_code: string; value_name: string }[];
  scopeValues: ScopeValue[];
  onChange: (patch: Partial<RequestRow>) => void;
  onRemove?: () => void;
}) {
  const search = row.search.trim();
  const matches = useQuery({
    enabled: !row.ent && search.length >= 1,
    queryKey: ["scoped-ent-search", search],
    queryFn: async () => (await searchEntitlements(search, 12)).data ?? [],
  });
  // Hide the list once the typed text is an exact code: it is sent as typed.
  const showMatches =
    !!search && (matches.data ?? []).length > 0 &&
    !(matches.data ?? []).some((e) => e.entitlementname.toLowerCase() === search.toLowerCase());
  const setScope = (i: number, patch: Partial<ScopeRow>) =>
    onChange({ scopes: row.scopes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2.5">
      <span className="mt-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">#{index}</span>
      <div className="min-w-0 flex-1">
        {row.ent ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5">
            <div className="min-w-0">
              <div className="font-semibold">{row.ent.entitlement_displayname ?? row.ent.entitlementname}</div>
              <div className="text-[11px] text-slate-500">
                <code>{row.ent.entitlementname}</code>
                {row.ent.app_name ? ` · ${row.ent.app_name}` : ""}
              </div>
            </div>
            <button type="button" className="rounded border border-gray-200 px-2 py-1 text-sm" onClick={() => onChange({ ent: null, search: "" })}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              className={inputCls}
              placeholder="Role or entitlement — search, or type its code or name"
              aria-label={`Requested access ${index}`}
              value={row.search}
              onChange={(e) => onChange({ search: e.target.value })}
            />
            {showMatches && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200">
                {(matches.data ?? []).map((e) => (
                  <button
                    key={e.entitlementid}
                    type="button"
                    className="w-full border-b border-slate-100 px-2 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => onChange({ ent: e, search: "" })}
                  >
                    <div className="font-semibold">{e.entitlement_displayname ?? e.entitlementname}</div>
                    <div className="text-[11px] text-slate-500">
                      <code>{e.entitlementname}</code>
                      {e.app_name ? ` · ${e.app_name}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-2">
          {row.scopes.map((s, i) => {
            const listId = `scope-values-${row.key}-${i}`;
            return (
              <div key={i} className="mb-1.5 flex flex-wrap items-center gap-2">
                <select
                  className="w-56 max-w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  aria-label={`Scope type ${i + 1} of access ${index}`}
                  value={s.type}
                  onChange={(e) => setScope(i, { type: e.target.value })}
                >
                  {scopeTypes.map((t) => (
                    <option key={t.value_code} value={t.value_code}>
                      {t.value_name}
                    </option>
                  ))}
                </select>
                <input
                  className="w-64 max-w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  list={listId}
                  placeholder="Value, e.g. IND BU or 2750"
                  aria-label={`Scope value ${i + 1} of access ${index}`}
                  value={s.value}
                  onChange={(e) => setScope(i, { value: e.target.value })}
                />
                <datalist id={listId}>
                  {scopeValues
                    .filter((v) => v.scope_type === s.type)
                    .slice(0, 200)
                    .map((v) => (
                      <option key={v.scope_id} value={v.scope_id}>
                        {v.scope_name !== v.scope_id ? v.scope_name : undefined}
                      </option>
                    ))}
                </datalist>
                <button
                  type="button"
                  className="rounded border border-gray-200 p-2"
                  aria-label="Remove scope"
                  onClick={() => onChange({ scopes: row.scopes.filter((_, j) => j !== i) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
              disabled={scopeTypes.length === 0}
              onClick={() =>
                onChange({
                  scopes: [
                    ...row.scopes,
                    { type: row.scopes[row.scopes.length - 1]?.type ?? scopeTypes[0]?.value_code ?? "", value: "" },
                  ],
                })
              }
            >
              <Plus className="h-3 w-3" /> Add scope
            </button>
            {row.scopes.length === 0 && <span className="text-xs text-slate-500">No scope: checked in every scope</span>}
          </div>
        </div>
      </div>
      {onRemove && (
        <button type="button" className="rounded border border-gray-200 p-2" aria-label={`Remove access ${index}`} onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function CheckResult({
  result,
  typeLabel,
  severityName,
  severityColor,
}: {
  result: ScopedCheckResult;
  typeLabel: (code?: string | null) => string;
  severityName: (code: string) => string;
  severityColor: (code: string) => string | undefined;
}) {
  const v = VERDICTS[result.verdict] ?? VERDICTS.UNRESOLVED;
  const Icon = result.verdict === "CLEAN" ? ShieldCheck : result.verdict === "UNRESOLVED" ? CircleHelp : ShieldAlert;
  const ref = (r: ScopedCheckAccessRef) => (
    <div key={`${r.item ?? ""}|${r.access}|${r.scopeType ?? ""}|${r.scopeId ?? ""}|${r.source ?? ""}`} className="mb-1">
      {r.item ? <span className="text-slate-500">#{r.item} </span> : null}
      <code className="break-all">{r.access}</code>
      <div className="text-[11px] text-slate-500">{r.scopeId ? `${typeLabel(r.scopeType)} ${r.scopeId}` : "every scope"}</div>
    </div>
  );

  return (
    <div className="mt-4">
      <div className="mb-3 rounded-lg p-3" style={{ background: v.bg, border: `1px solid ${v.color}55` }}>
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-[18px] w-[18px]" style={{ color: v.color }} />
          <b className="text-[15px]" style={{ color: v.color }}>
            {v.label}
          </b>
          <span className="text-sm text-slate-500">
            {result.violations.length} rule{result.violations.length === 1 ? "" : "s"} broken
            {result.rulesets.length > 0 && <> · {result.rulesets.join(", ")}</>}
            {result.user.found ? <> · for {result.user.username}</> : <> · new hire</>}
          </span>
        </div>
        <div className="mt-1 text-sm text-slate-700">{v.text}</div>
      </div>

      {(result.errors.length > 0 || result.warnings.length > 0) && (
        <div className="mb-3 flex flex-col gap-1">
          {result.errors.map((e, i) => (
            <div key={`e${i}`} className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-900">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {e.item ? <b>#{e.item} </b> : null}
              {e.message}
              {Array.isArray(e.candidates) && e.candidates.length > 0 && (
                <div className="mt-0.5 text-xs">
                  Candidates:{" "}
                  {e.candidates
                    .map((c) => {
                      const o = (c ?? {}) as Record<string, unknown>;
                      return String(o.code ?? o.access ?? o.entitlementname ?? o.name ?? JSON.stringify(c));
                    })
                    .join(", ")}
                </div>
              )}
            </div>
          ))}
          {result.warnings.map((w, i) => (
            <div key={`w${i}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {w.item ? <b>#{w.item} </b> : null}
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 font-semibold text-gray-900">How each item was checked</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="p-2">#</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Matched</th>
                <th className="p-2">System</th>
                <th className="p-2">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((it) => (
                <tr key={it.item} className="border-b border-slate-100 align-top">
                  <td className="p-2">{it.item}</td>
                  <td className="p-2">{String(it.input?.access ?? it.access ?? "—")}</td>
                  <td className="p-2">
                    {it.resolved ? (
                      <>
                        <b>{it.access_name ?? it.access}</b>{" "}
                        <span className="text-slate-500">
                          {it.access}
                          {it.instance ? ` · ${it.instance}` : ""}
                        </span>
                      </>
                    ) : (
                      <Badge label="Not found" color="#dc2626" />
                    )}
                  </td>
                  <td className="p-2">{(it.systems ?? []).join(", ") || "—"}</td>
                  <td className="p-2">
                    <CheckedIn item={it} typeLabel={typeLabel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 font-semibold text-gray-900">Rules that would be broken ({result.violations.length})</div>
        {result.violations.length === 0 ? (
          <div className="p-4 text-center font-semibold text-green-700">
            <ShieldCheck className="mr-1 inline h-4 w-4 align-[-3px]" /> No conflicts
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <th className="p-2">Rule</th>
                  <th className="p-2">Severity</th>
                  <th className="p-2">Result</th>
                  <th className="p-2">Conflicts with</th>
                  <th className="p-2">Requested</th>
                  <th className="p-2">Conflicting</th>
                </tr>
              </thead>
              <tbody>
                {result.violations.map((x) => (
                  <tr key={`${x.ruleset}|${x.ruleId}`} className="border-b border-slate-100 align-top">
                    <td className="min-w-[200px] p-2">
                      <b title={x.ruleCode}>{x.ruleName ?? x.ruleCode}</b>
                    </td>
                    <td className="p-2">
                      <Badge label={severityName(x.severity)} color={severityColor(x.severity)} />
                    </td>
                    <td className="p-2">
                      <Badge label={x.enforcement} color={x.enforcement === "BLOCK" ? "#dc2626" : "#d97706"} />
                    </td>
                    <td className="p-2">{CONFLICT_WITH[x.conflictWith] ?? x.conflictWith}</td>
                    <td className="p-2">{x.requested.map(ref)}</td>
                    <td className="p-2">{x.conflicting.map(ref)}</td>
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

function CheckedIn({ item, typeLabel }: { item: ScopedCheckItem; typeLabel: (code?: string | null) => string }) {
  if (!item.resolved) return <span className="text-slate-500">—</span>;
  const grantsBy = (item.system_scope_types ?? []).map(typeLabel).join(", ");
  if (item.scope_mode === "NOT_APPLICABLE") {
    return <span className="text-slate-500">No data scope in this system — counts everywhere</span>;
  }
  if (item.scope_mode === "ALL_SCOPES") {
    const given = item.input?.scopes;
    return (
      <span>
        Every scope {Array.isArray(given) && given.length > 0 ? "(the scope given could not be applied)" : "(none given)"}
        {grantsBy && <span className="text-slate-500"> · this system grants by {grantsBy}</span>}
      </span>
    );
  }
  return (
    <span>
      {(item.scopes ?? []).map((s, i) => (
        <span key={i} className="block">
          {typeLabel(s.type)} <b>{s.scope_id ?? s.value}</b>
          {s.resolved_by === "LINK" && (s.maps_to ?? []).length > 0 && (
            <span className="text-slate-500"> → {(s.maps_to ?? []).map((m) => `${typeLabel(m.type)} ${m.scope_id}`).join(", ")}</span>
          )}
        </span>
      ))}
    </span>
  );
}
