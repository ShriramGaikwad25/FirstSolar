"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { getNhiV2TenantId, nhiV2ExecuteQuery } from "@/lib/nhi-v2-api";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";
import { Nhi2PageIntro, Nhi2Tabs } from "@/components/non-human-identity/nhi2/Nhi2Tabs";
import { RfcCallsPage } from "@/components/non-human-identity/RfcCallsPage";
import { EmergencyUsagePage } from "@/components/non-human-identity/EmergencyUsagePage";

const TABS = [
  { key: "stream", label: "Top agents (24h)" },
  { key: "rfc", label: "RFC Calls" },
  { key: "auth", label: "Auth events" },
  { key: "emergency", label: "Emergency usage" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function StreamTab() {
  const [topAgents, setTopAgents] = useState<Record<string, unknown>[]>([]);
  const [recent, setRecent] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const tid = getNhiV2TenantId();
      const [{ rows: top }, { rows: rec }] = await Promise.all([
        nhiV2ExecuteQuery(
          `SELECT n.nhi_id, n.name AS nhi_name, n.nhi_type,
                  count(*)::int AS actions_24h,
                  count(*) FILTER (WHERE l.outcome::text = 'denied')::int AS denied_24h,
                  count(*) FILTER (WHERE l.hallucination_flag = true)::int AS hallucinations_24h,
                  coalesce(sum(l.total_tokens), 0)::bigint AS tokens_24h,
                  round(coalesce(sum(l.cost_usd), 0)::numeric, 2) AS cost_usd_24h,
                  max(l.occurred_at) AS last_seen,
                  round(avg(l.latency_ms))::int AS avg_latency_ms
             FROM public.kf_nhi_agent_action_log l
             JOIN public.kf_nhi_identity n ON n.nhi_id = l.nhi_id
            WHERE l.tenant_id = ?::uuid
              AND l.occurred_at > now() - interval '24 hours'
            GROUP BY n.nhi_id, n.name, n.nhi_type
            ORDER BY actions_24h DESC
            LIMIT 25`,
          [tid]
        ),
        nhiV2ExecuteQuery(
          `SELECT l.action_id, l.nhi_id, n.name AS nhi_name, n.nhi_type,
                  l.tool_name, l.intent, l.outcome,
                  l.tokens_in, l.tokens_out, l.latency_ms, l.cost_usd,
                  l.target_object_type, l.target_object_id,
                  l.hallucination_flag, l.occurred_at
             FROM public.kf_nhi_agent_action_log l
        LEFT JOIN public.kf_nhi_identity n ON n.nhi_id = l.nhi_id
            WHERE l.tenant_id = ?::uuid
              AND l.occurred_at > now() - interval '24 hours'
            ORDER BY l.occurred_at DESC
            LIMIT 200`,
          [tid]
        ),
      ]);
      setTopAgents(top);
      setRecent(rec);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading agent activity…</p>;
  }
  if (err) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {err}
        <button type="button" onClick={() => void load()} className="ml-3 underline">
          Retry
        </button>
      </div>
    );
  }

  const totalActions = topAgents.reduce((s, a) => s + asNum(a.actions_24h), 0);
  const totalDenied = topAgents.reduce((s, a) => s + asNum(a.denied_24h), 0);
  const totalTokens = topAgents.reduce((s, a) => s + asNum(a.tokens_24h), 0);
  const totalCost = topAgents.reduce((s, a) => s + asNum(a.cost_usd_24h), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active agents (24h)" value={String(topAgents.length)} />
        <KpiCard label="Total actions" value={totalActions.toLocaleString()} />
        <KpiCard
          label="Denied"
          value={String(totalDenied)}
          tone={totalDenied > 0 ? "warn" : "ok"}
        />
        <KpiCard
          label="Tokens used"
          value={totalTokens.toLocaleString()}
          sub={`$${totalCost.toFixed(2)} cost`}
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Top agents by 24-hour action volume</h2>
        <p className="mt-1 text-xs text-slate-500">
          Aggregated from <code className="rounded bg-slate-100 px-1">kf_nhi_agent_action_log</code>
        </p>
        <SimpleTable
          rows={topAgents}
          empty="No agent activity in the last 24 hours."
          columns={[
            { key: "nhi_name", label: "Agent" },
            { key: "nhi_type", label: "Type" },
            { key: "actions_24h", label: "Actions" },
            { key: "denied_24h", label: "Denied" },
            { key: "hallucinations_24h", label: "Hallucinations" },
            { key: "avg_latency_ms", label: "Avg latency (ms)" },
            { key: "tokens_24h", label: "Tokens" },
            { key: "cost_usd_24h", label: "Cost (USD)" },
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Latest 200 actions</h2>
        <SimpleTable
          rows={recent}
          empty="No recent actions."
          columns={[
            { key: "occurred_at", label: "When" },
            { key: "nhi_name", label: "Agent" },
            { key: "tool_name", label: "Tool" },
            { key: "intent", label: "Intent" },
            { key: "outcome", label: "Outcome" },
            { key: "latency_ms", label: "Latency" },
            { key: "tokens_in", label: "In" },
            { key: "tokens_out", label: "Out" },
            { key: "target_object_type", label: "Target" },
          ]}
        />
      </section>
    </div>
  );
}

function AuthEventsTab() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const tid = getNhiV2TenantId();
      const { rows: r } = await nhiV2ExecuteQuery(
        `SELECT a.auth_event_id, a.nhi_id, n.name AS nhi_name, n.nhi_type,
                a.outcome, a.failure_reason, a.source_ip, a.user_agent,
                a.mfa_used, a.occurred_at
           FROM public.kf_nhi_auth_event a
      LEFT JOIN public.kf_nhi_identity n ON n.nhi_id = a.nhi_id
          WHERE a.tenant_id = ?::uuid
            AND a.occurred_at > now() - interval '14 days'
          ORDER BY a.occurred_at DESC
          LIMIT 500`,
        [tid]
      );
      setRows(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading auth events…</p>;
  if (err) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {err}
      </div>
    );
  }

  const failed = rows.filter((r) => asText(r.outcome) !== "success").length;

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        {rows.length} events in the last 14 days
        {failed > 0 && (
          <>
            {" "}
            · <span className="font-semibold text-red-600">{failed} non-success</span>
          </>
        )}
      </p>
      <SimpleTable
        rows={rows}
        empty="No auth events in the last 14 days."
        columns={[
          { key: "occurred_at", label: "When" },
          { key: "nhi_name", label: "NHI" },
          { key: "nhi_type", label: "Type" },
          { key: "outcome", label: "Outcome" },
          { key: "mfa_used", label: "MFA" },
          { key: "source_ip", label: "Source IP" },
          { key: "failure_reason", label: "Reason" },
        ]}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  const color = tone === "warn" ? "text-red-600" : tone === "ok" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function SimpleTable({
  rows,
  columns,
  empty,
}: {
  rows: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  empty: string;
}) {
  if (!rows.length) {
    return <p className="mt-3 text-sm text-slate-500">{empty}</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/80">
              {columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {formatCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(v);
}

function Nhi2ActivityContent() {
  const [tab, setTab] = useState<TabKey>("stream");

  return (
    <div className={NHI2_PAGE_SHELL_CLASS}>
      <Nhi2PageIntro
        title="Runtime activity"
        description="Real-time and recent runtime events from across the NHI fleet — what ran, who triggered it, whether it was allowed, and what was emergency."
      />
      <Nhi2Tabs tabs={[...TABS]} active={tab} onChange={(k) => setTab(k as TabKey)} />
      {tab === "stream" && <StreamTab />}
      {tab === "rfc" && <RfcCallsPage apiMode="v2" />}
      {tab === "auth" && <AuthEventsTab />}
      {tab === "emergency" && <EmergencyUsagePage apiMode="v2" />}
    </div>
  );
}

export function Nhi2ActivityPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <Nhi2ActivityContent />
    </Suspense>
  );
}
