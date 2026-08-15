"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  searchUsers,
  searchEntitlements,
  searchPrivileges,
  getUserAccess,
  simulateUserAccess,
  simulateRole,
  listRulesets,
} from "@/lib/api/rm";
import type {
  EntitlementSearchRow,
  PrivilegeSearchRow,
  SimulationResult,
  SimulationViolationRow,
  UserSearchRow,
} from "@/types/rm-simulation";
import type { RmRuleset } from "@/types/rm-dashboard";
import Badge from "@/components/Badge";
import {
  Play,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  UserSearch,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Mode = "EXISTING_USER" | "NEW_HIRE" | "ROLE_CHECK";

const statusBadgeColor: Record<string, string> = {
  NEW: "#dc2626",
  EXISTING: "#f59e0b",
  RESOLVED: "#16a34a",
};

export default function SimulationPageClient() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("EXISTING_USER");
  const [user, setUser] = useState<UserSearchRow | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [rulesetId, setRulesetId] = useState<number | null>(null);

  const [addEnts, setAddEnts] = useState<EntitlementSearchRow[]>([]);
  const [addPrivs, setAddPrivs] = useState<PrivilegeSearchRow[]>([]);
  const [removeEnts, setRemoveEnts] = useState<string[]>([]);

  const [entSearch, setEntSearch] = useState("");
  const [privSearch, setPrivSearch] = useState("");
  const [roleToCheck, setRoleToCheck] = useState<EntitlementSearchRow | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggleExpanded = (id: number) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const rulesets = useQuery({
    queryKey: ["rulesets-active", "simulation"],
    queryFn: async () => {
      const { data } = await listRulesets("ACTIVE", 1, 500);
      const rows = data ?? [];
      return rows.filter(
        (r: RmRuleset) => r.status == null || r.status === "" || r.status === "ACTIVE"
      );
    },
  });

  useEffect(() => {
    if (rulesetId != null) return;
    const first = rulesets.data?.[0];
    if (first) setRulesetId(first.ruleset_id);
  }, [rulesetId, rulesets.data]);

  const userResults = useQuery({
    enabled: mode === "EXISTING_USER" && userSearch.length >= 1,
    queryKey: ["sim-user-search", userSearch],
    queryFn: async () => (await searchUsers(userSearch, 15)).data ?? [],
  });

  const userAccess = useQuery({
    enabled: !!user,
    queryKey: ["sim-user-access", user?.userid],
    queryFn: async () => (await getUserAccess(user!.userid)).data,
  });

  const entResults = useQuery({
    enabled: entSearch.length >= 1,
    queryKey: ["sim-ent-search", entSearch],
    queryFn: async () => (await searchEntitlements(entSearch, 15)).data ?? [],
  });

  const privResults = useQuery({
    enabled: privSearch.length >= 1,
    queryKey: ["sim-priv-search", privSearch],
    queryFn: async () => {
      const { data } = await searchPrivileges("GENERIC", 200);
      const q = privSearch.trim().toLowerCase();
      if (!q) return [] as PrivilegeSearchRow[];
      return (data ?? [])
        .filter(
          (p) =>
            p.privilege_code.toLowerCase().includes(q) ||
            (p.privilege_name ?? "").toLowerCase().includes(q)
        )
        .slice(0, 15);
    },
  });

  const roleSearchResults = useQuery({
    enabled: mode === "ROLE_CHECK" && entSearch.length >= 1,
    queryKey: ["sim-role-search", entSearch],
    queryFn: async () => (await searchEntitlements(entSearch, 15)).data ?? [],
  });

  const simulate = useMutation({
    mutationFn: async (): Promise<SimulationResult> => {
      if (!rulesetId) throw new Error("Pick a ruleset");
      if (mode === "ROLE_CHECK") {
        if (!roleToCheck) throw new Error("Pick a role to check");
        const r = await simulateRole(roleToCheck.entitlementid, rulesetId);
        if (!r.success) throw new Error(r.error ?? "Simulation failed");
        if (!r.data) throw new Error(r.error ?? "No simulation data");
        return r.data;
      }
      const r = await simulateUserAccess({
        user_id: mode === "EXISTING_USER" ? user?.userid ?? null : null,
        ruleset_id: rulesetId,
        add_entitlement_ids: addEnts.map((e) => e.entitlementid),
        add_privilege_ids: addPrivs.map((p) => p.privilege_id),
        remove_entitlement_ids: removeEnts,
      });
      if (!r.success) throw new Error(r.error ?? "Simulation failed");
      if (!r.data) throw new Error(r.error ?? "No simulation data");
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sim-user-access"] });
    },
  });

  const result = simulate.data;
  const summary = result?.summary;

  const addEnt = (e: EntitlementSearchRow) => {
    if (!addEnts.find((x) => x.entitlementid === e.entitlementid)) {
      setAddEnts([...addEnts, e]);
    }
    setEntSearch("");
  };
  const addPriv = (p: PrivilegeSearchRow) => {
    if (!addPrivs.find((x) => x.privilege_id === p.privilege_id)) {
      setAddPrivs([...addPrivs, p]);
    }
    setPrivSearch("");
  };
  const toggleRevoke = (entId: string) => {
    setRemoveEnts((r) => (r.includes(entId) ? r.filter((x) => x !== entId) : [...r, entId]));
  };

  const reset = () => {
    setAddEnts([]);
    setAddPrivs([]);
    setRemoveEnts([]);
    simulate.reset();
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0" />
          What-if simulation
        </h1>
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[220px]"
          value={rulesetId ?? ""}
          onChange={(e) => setRulesetId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Pick ruleset…</option>
          {rulesets.data?.map((r) => (
            <option key={r.ruleset_id} value={r.ruleset_id}>
              {r.ruleset_code}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <ModeTab
            active={mode === "EXISTING_USER"}
            onClick={() => {
              setMode("EXISTING_USER");
              reset();
            }}
            icon={<UserSearch className="h-4 w-4" />}
            label="Existing user"
            hint="Add/remove entitlements on a real user"
          />
          <ModeTab
            active={mode === "NEW_HIRE"}
            onClick={() => {
              setMode("NEW_HIRE");
              reset();
              setUser(null);
            }}
            icon={<UserPlus className="h-4 w-4" />}
            label="Hypothetical new hire"
            hint="Start from zero access, pick proposed roles"
          />
          <ModeTab
            active={mode === "ROLE_CHECK"}
            onClick={() => {
              setMode("ROLE_CHECK");
              reset();
              setUser(null);
            }}
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Toxic role check"
            hint="Intra-role SOD conflict in a single role"
          />
        </div>

        {mode === "EXISTING_USER" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">User</label>
              {user ? (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{user.displayname}</div>
                    <div className="text-slate-500 text-xs">
                      {user.username} · {user.title ?? ""} · {user.department ?? ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-sm rounded border border-gray-200 px-2 py-1"
                    onClick={() => {
                      setUser(null);
                      setUserSearch("");
                      reset();
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Search by name, username, or employee ID…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  {userSearch && (
                    <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-md mt-1">
                      {(userResults.data ?? []).map((u) => (
                        <button
                          key={u.userid}
                          type="button"
                          className="w-full text-left px-2 py-2 border-b border-slate-100 text-sm hover:bg-slate-50"
                          onClick={() => {
                            setUser(u);
                            setUserSearch("");
                          }}
                        >
                          <div className="font-semibold">{u.displayname}</div>
                          <div className="text-slate-500 text-[11px]">
                            {u.username} — {u.title ?? "—"}, {u.department ?? "—"}
                          </div>
                        </button>
                      ))}
                      {(userResults.data ?? []).length === 0 && !userResults.isLoading && (
                        <div className="p-2 text-slate-500 text-xs">No matches</div>
                      )}
                    </div>
                  )}
                </>
              )}

              {user && userAccess.data && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Current entitlements ({userAccess.data.entitlements.length})
                  </label>
                  <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-md">
                    {userAccess.data.entitlements.map((e) => {
                      const revoked = removeEnts.includes(e.entitlementid);
                      return (
                        <div
                          key={e.entitlementid}
                          className={`px-2 py-2 border-b border-slate-100 flex items-center justify-between text-sm ${
                            revoked ? "bg-red-50/80 line-through opacity-80" : ""
                          }`}
                        >
                          <div>
                            <div className="font-medium">
                              {e.entitlement_displayname ?? e.entitlementname}
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              <code>{e.entitlementname}</code> · {e.privilege_count} privs
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs rounded border border-gray-200 px-2 py-0.5 shrink-0"
                            style={{ color: revoked ? "#16a34a" : "#dc2626" }}
                            onClick={() => toggleRevoke(e.entitlementid)}
                          >
                            {revoked ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Plus className="h-3 w-3" /> Restore
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5">
                                <Minus className="h-3 w-3" /> Revoke
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                    {userAccess.data.entitlements.length === 0 && (
                      <div className="p-2 text-slate-500 text-xs">User has no entitlements assigned</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <ProposedPanel
              entSearch={entSearch}
              setEntSearch={setEntSearch}
              entResults={entResults.data ?? []}
              addEnts={addEnts}
              onAddEnt={addEnt}
              onRemoveEnt={(id) => setAddEnts((x) => x.filter((e) => e.entitlementid !== id))}
              privSearch={privSearch}
              setPrivSearch={setPrivSearch}
              privResults={privResults.data ?? []}
              addPrivs={addPrivs}
              onAddPriv={addPriv}
              onRemovePriv={(id) => setAddPrivs((x) => x.filter((p) => p.privilege_id !== id))}
            />
          </div>
        )}

        {mode === "NEW_HIRE" && (
          <>
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-2.5 mb-3 text-sm text-slate-700">
              <Info className="inline h-3.5 w-3.5 align-[-2px] mr-1" />
              Baseline = zero access. Choose proposed roles and privileges, then run simulation.
            </div>
            <ProposedPanel
              entSearch={entSearch}
              setEntSearch={setEntSearch}
              entResults={entResults.data ?? []}
              addEnts={addEnts}
              onAddEnt={addEnt}
              onRemoveEnt={(id) => setAddEnts((x) => x.filter((e) => e.entitlementid !== id))}
              privSearch={privSearch}
              setPrivSearch={setPrivSearch}
              privResults={privResults.data ?? []}
              addPrivs={addPrivs}
              onAddPriv={addPriv}
              onRemovePriv={(id) => setAddPrivs((x) => x.filter((p) => p.privilege_id !== id))}
            />
          </>
        )}

        {mode === "ROLE_CHECK" && (
          <div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 mb-3 text-sm text-slate-800">
              <AlertTriangle className="inline h-3.5 w-3.5 text-amber-600 align-[-2px] mr-1" />
              Detects <strong>toxic combinations inside a single role</strong> (intra-role SOD).
            </div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role to check</label>
            {roleToCheck ? (
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {roleToCheck.entitlement_displayname ?? roleToCheck.entitlementname}
                  </div>
                  <div className="text-slate-500 text-xs">
                    <code>{roleToCheck.entitlementname}</code> · {roleToCheck.privilege_count}{" "}
                    privileges
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm rounded border border-gray-200 px-2 py-1"
                  onClick={() => {
                    setRoleToCheck(null);
                    setEntSearch("");
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Search for a role…"
                  value={entSearch}
                  onChange={(e) => setEntSearch(e.target.value)}
                />
                {entSearch && (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md mt-1">
                    {(roleSearchResults.data ?? []).map((e) => (
                      <button
                        key={e.entitlementid}
                        type="button"
                        className="w-full text-left px-2 py-2 border-b border-slate-100 text-sm hover:bg-slate-50"
                        onClick={() => {
                          setRoleToCheck(e);
                          setEntSearch("");
                        }}
                      >
                        <div className="font-semibold">
                          {e.entitlement_displayname ?? e.entitlementname}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          <code>{e.entitlementname}</code> · {e.privilege_count} privs
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            onClick={reset}
            disabled={simulate.isPending}
          >
            Reset
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={
              simulate.isPending ||
              !rulesetId ||
              (mode === "EXISTING_USER" && !user) ||
              (mode === "ROLE_CHECK" && !roleToCheck) ||
              (mode === "NEW_HIRE" && addEnts.length === 0 && addPrivs.length === 0)
            }
            onClick={() => void simulate.mutate()}
          >
            <Play className="h-3.5 w-3.5" />
            {simulate.isPending ? "Simulating…" : "Run simulation"}
          </button>
        </div>
      </div>

      {simulate.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-900 p-3 text-sm mb-4">
          <strong>Error:</strong> {String(simulate.error)}
        </div>
      )}

      {result && summary && (
        <>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4"
          >
            <KpiCard label="Current violations" value={summary.current_violations} tone="neutral" />
            <KpiCard
              label="Projected violations"
              value={summary.projected_violations}
              tone={
                summary.projected_violations > summary.current_violations
                  ? "danger"
                  : summary.projected_violations < summary.current_violations
                    ? "good"
                    : "neutral"
              }
            />
            <KpiCard
              label="New (added)"
              value={summary.new_violations}
              tone={summary.new_violations > 0 ? "danger" : "neutral"}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
            <KpiCard
              label="Resolved"
              value={summary.resolved_violations}
              tone={summary.resolved_violations > 0 ? "good" : "neutral"}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <KpiCard
              label="Risk score Δ"
              value={
                summary.risk_score_added - summary.risk_score_removed > 0
                  ? `+${summary.risk_score_added - summary.risk_score_removed}`
                  : `${summary.risk_score_added - summary.risk_score_removed}`
              }
              tone={
                summary.risk_score_added > summary.risk_score_removed
                  ? "danger"
                  : summary.risk_score_added < summary.risk_score_removed
                    ? "good"
                    : "neutral"
              }
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-3 text-xs text-slate-600 border-b border-gray-100">
              Privilege delta: <strong>{summary.current_privilege_count}</strong> current →{" "}
              <strong>{summary.projected_privilege_count}</strong> projected
              {summary.added_privilege_count > 0 && (
                <span className="text-red-600"> +{summary.added_privilege_count}</span>
              )}
              {summary.added_privilege_count > 0 && summary.removed_privilege_count > 0 && ", "}
              {summary.removed_privilege_count > 0 && (
                <span className="text-green-600"> −{summary.removed_privilege_count}</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-sm text-left">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[10%]" />
                  <col className="w-[28%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 text-left">
                    <th className="p-2" />
                    <th className="p-2">Change</th>
                    <th className="p-2">Rule</th>
                    <th className="p-2">Severity</th>
                    <th className="p-2 text-center">Risk</th>
                    <th className="p-2 text-center">Current</th>
                    <th className="p-2 text-center">Projected</th>
                  </tr>
                </thead>
                <tbody>
                  {result.violations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-green-700">
                        <ShieldCheck className="inline h-4 w-4" /> No SOD conflicts projected
                      </td>
                    </tr>
                  )}
                  {result.violations.map((v) => (
                    <Fragment key={v.rule_id}>
                      <tr
                        className={
                          v.change_status === "NEW"
                            ? "bg-red-50/60"
                            : v.change_status === "RESOLVED"
                              ? "bg-green-50/60"
                              : ""
                        }
                      >
                        <td className="p-1.5">
                          <button
                            type="button"
                            className="p-0.5 rounded border border-gray-200"
                            onClick={() => toggleExpanded(v.rule_id)}
                          >
                            {expanded[v.rule_id] ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        </td>
                        <td className="p-1.5">
                          <Badge
                            label={v.change_status}
                            color={statusBadgeColor[v.change_status] ?? "#64748b"}
                          />
                        </td>
                        <td className="p-1.5">
                          <div className="font-semibold truncate">{v.rule_name ?? v.rule_code}</div>
                          <code className="text-[11px] text-slate-500 truncate block">{v.rule_code}</code>
                        </td>
                        <td className="p-1.5">
                          <Badge
                            label={v.severity_name ?? v.severity}
                            color={v.severity_color}
                          />
                        </td>
                        <td className="p-1.5 text-center tabular-nums">{v.risk_score}</td>
                        <td className="p-1.5 text-center">{v.current_violation ? "❗" : ""}</td>
                        <td className="p-1.5 text-center">{v.projected_violation ? "❗" : ""}</td>
                      </tr>
                      {expanded[v.rule_id] && (
                        <tr>
                          <td colSpan={7} className="p-4 bg-slate-50 text-sm text-slate-700">
                            {v.rule_description && <p className="m-0 mb-2">{v.rule_description}</p>}
                            {v.remediation && (
                              <p className="text-xs text-slate-600 mb-2">
                                <strong>Remediation:</strong> {v.remediation}
                              </p>
                            )}
                            <DetailsBlock details={v.details} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left flex flex-col rounded-lg border p-3 transition-colors ${
        active ? "bg-sky-50 border-2 border-blue-600" : "bg-white border border-slate-200"
      }`}
    >
      <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-900">
        {icon} {label}
      </div>
      <div className="text-slate-500 text-[11px] mt-0.5">{hint}</div>
    </button>
  );
}

function ProposedPanel(p: {
  entSearch: string;
  setEntSearch: (s: string) => void;
  entResults: EntitlementSearchRow[];
  addEnts: EntitlementSearchRow[];
  onAddEnt: (e: EntitlementSearchRow) => void;
  onRemoveEnt: (id: string) => void;
  privSearch: string;
  setPrivSearch: (s: string) => void;
  privResults: PrivilegeSearchRow[];
  addPrivs: PrivilegeSearchRow[];
  onAddPriv: (pp: PrivilegeSearchRow) => void;
  onRemovePriv: (id: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Proposed entitlements</label>
      <input
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        placeholder="Search roles/entitlements…"
        value={p.entSearch}
        onChange={(e) => p.setEntSearch(e.target.value)}
      />
      {p.entSearch && p.entResults.length > 0 && (
        <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-md mt-1">
          {p.entResults.map((e) => (
            <button
              key={e.entitlementid}
              type="button"
              className="w-full text-left px-2 py-2 border-b border-slate-100 text-sm hover:bg-slate-50"
              onClick={() => p.onAddEnt(e)}
            >
              <div className="font-medium text-sm">
                {e.entitlement_displayname ?? e.entitlementname}
              </div>
              <div className="text-slate-500 text-[11px]">
                <code>{e.entitlementname}</code> · {e.privilege_count} privs
              </div>
            </button>
          ))}
        </div>
      )}
      {p.addEnts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {p.addEnts.map((e) => (
            <span
              key={e.entitlementid}
              className="inline-flex items-center gap-1 text-xs bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5"
            >
              {e.entitlement_displayname ?? e.entitlementname}
              <button
                type="button"
                className="text-slate-500 p-0 leading-none"
                onClick={() => p.onRemoveEnt(e.entitlementid)}
                aria-label="Remove"
              >
                <Minus className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <label className="block text-xs font-medium text-slate-600 mt-4 mb-1">
        Proposed direct privileges
      </label>
      <input
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        placeholder="Search privileges (e.g. AP_CREATE_PAYMENT)…"
        value={p.privSearch}
        onChange={(e) => p.setPrivSearch(e.target.value)}
      />
      {p.privSearch && p.privResults.length > 0 && (
        <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-md mt-1">
          {p.privResults.map((pp) => (
            <button
              key={pp.privilege_id}
              type="button"
              className="w-full text-left px-2 py-2 border-b border-slate-100 text-sm hover:bg-slate-50"
              onClick={() => p.onAddPriv(pp)}
            >
              <code className="text-xs">{pp.privilege_code}</code>
              <div className="text-slate-500 text-[11px]">
                {pp.privilege_name ?? pp.system_type}
              </div>
            </button>
          ))}
        </div>
      )}
      {p.addPrivs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {p.addPrivs.map((pp) => (
            <span
              key={pp.privilege_id}
              className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
            >
              <code>{pp.privilege_code}</code>
              <button
                type="button"
                className="text-slate-500 p-0"
                onClick={() => p.onRemovePriv(pp.privilege_id)}
                aria-label="Remove"
              >
                <Minus className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone: "good" | "danger" | "neutral";
  icon?: ReactNode;
}) {
  const bg =
    tone === "danger" ? "bg-red-50" : tone === "good" ? "bg-green-50" : "bg-slate-50";
  const color =
    tone === "danger" ? "#dc2626" : tone === "good" ? "#16a34a" : "#0f172a";
  return (
    <div className={`rounded-lg border border-gray-200 p-3 ${bg}`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-2xl font-bold flex items-center gap-1" style={{ color }}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function DetailsBlock({ details }: { details: SimulationViolationRow["details"] }) {
  const d = details ?? [];
  if (d.length === 0) return null;
  const sideA = d.filter((x) => x.condition_side === "A");
  const sideB = d.filter((x) => x.condition_side === "B");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <SideCard label="Side A — Function" entries={sideA} />
      <SideCard label="Side B — Function" entries={sideB} />
    </div>
  );
}

function SideCard({
  label,
  entries,
}: {
  label: string;
  entries: SimulationViolationRow["details"];
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-2 bg-white text-xs">
      <div className="text-slate-500 text-[11px] mb-1">{label}</div>
      {entries.length === 0 && <div className="text-slate-500">No hit</div>}
      {entries.map((d) => (
        <div key={d.function_id} className="mb-2 last:mb-0">
          <div className="font-semibold text-sm">{d.function_code}</div>
          <div className="text-[10px] text-slate-500">{d.system_type}</div>
          <div className="mt-1 flex flex-col gap-0.5">
            {(d.hit_privileges ?? []).map((p) => (
              <div key={p.privilege_id} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={
                    p.source === "CURRENT"
                      ? "bg-indigo-100 text-indigo-900"
                      : p.source === "PROPOSED_DIRECT"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-fuchsia-100 text-fuchsia-900"
                  }
                  style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3 }}
                >
                  {p.source === "PROPOSED_VIA_ROLE" && p.proposed_entitlement_name
                    ? `via ${p.proposed_entitlement_name}`
                    : p.source.replaceAll("_", " ").toLowerCase()}
                </span>
                <code>{p.privilege_code}</code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
