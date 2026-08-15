"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import {
  getNhiV2TenantId,
  nhiV2ExecuteQuery,
  nhiV2ExecuteScalar,
} from "@/lib/nhi-v2-api";
import { toArray, toObject } from "@/lib/nhi-v2-normalize";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";

type Row = Record<string, unknown>;
type LookupOption = { code: string; label: string };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "type", label: "Type Details" },
  { key: "agent", label: "Agent Profile", showFor: ["agent"] },
  { key: "capabilities", label: "Capabilities", showFor: ["agent", "service_account", "bot"] },
  { key: "credentials", label: "Credentials" },
  { key: "relationships", label: "Relationships" },
  { key: "endpoints", label: "Endpoints" },
  { key: "delegations", label: "Delegations", showFor: ["agent", "service_account", "bot"] },
  { key: "accounts", label: "Accounts" },
  { key: "audit", label: "Audit" },
] as const;

const INTENTS = ["read", "write", "execute", "monitor", "analyze", "admin", "communicate", "learn"];
const RISKS = ["low", "medium", "high", "critical"];
const ENDPOINT_TYPES = [
  "http_api",
  "webhook_url",
  "sap_rfc_dest",
  "sap_trusted_system",
  "oauth_redirect",
  "sftp_host",
  "kafka_topic",
  "grpc_host",
  "outbound_ip",
  "event_bridge",
];
const AUTH_MODES = ["oauth2", "basic", "cert", "kerberos", "iam_role", "mtls"];

async function runRows(query: string, parameters: unknown[] = []): Promise<Row[]> {
  const { rows } = await nhiV2ExecuteQuery(query, parameters);
  return rows;
}

async function runScalar(query: string, parameters: unknown[] = []): Promise<unknown> {
  return nhiV2ExecuteScalar(query, parameters);
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return Boolean(v);
}

function toLocalDT(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDT(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function optionsOrFallback(rows: LookupOption[] | undefined, fallback: string[]): LookupOption[] {
  if (Array.isArray(rows) && rows.length > 0) return rows;
  return fallback.map((c) => ({ code: c, label: c }));
}

function riskChipClass(risk: string): string {
  const r = risk.toLowerCase();
  if (r === "critical") return "bg-red-100 text-red-800";
  if (r === "high") return "bg-orange-100 text-orange-800";
  if (r === "low") return "bg-green-100 text-green-800";
  return "bg-amber-100 text-amber-800";
}

function Chip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ${className}`}>
      {text}
    </span>
  );
}

function Badge({ text, tone = "slate" }: { text: string; tone?: "slate" | "blue" | "red" | "green" | "amber" }) {
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : tone === "red"
        ? "bg-red-50 text-red-700 border-red-200"
        : tone === "green"
          ? "bg-green-50 text-green-700 border-green-200"
          : tone === "amber"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{text}</span>;
}

export function Nhi2IdentityEditorPage({ nhiId }: { nhiId: string }) {
  const router = useRouter();

  const [detail, setDetail] = useState<Row | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [apps, setApps] = useState<Row[]>([]);
  const [lookups, setLookups] = useState<Record<string, LookupOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [capabilities, setCapabilities] = useState<Row[]>([]);
  const [endpoints, setEndpoints] = useState<Row[]>([]);
  const [delegations, setDelegations] = useState<Row[]>([]);
  const [secrets, setSecrets] = useState<Row[]>([]);
  const [lineage, setLineage] = useState<{ outbound: Row[]; inbound: Row[] }>({ outbound: [], inbound: [] });
  const [nhiAccounts, setNhiAccounts] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [otherNhis, setOtherNhis] = useState<Row[]>([]);

  const loadLookups = useCallback(async () => {
    const cats = [
      "state",
      "risk_level",
      "review_status",
      "criticality",
      "execution_type",
      "data_classification",
      "nhi_type",
      "secret_type",
      "lineage_relation",
    ];
    const out: Record<string, LookupOption[]> = {};
    await Promise.all(
      cats.map(async (c) => {
        try {
          const rows = await runRows(
            `SELECT code, label FROM public.kf_nhi_lookup_options(?::varchar, NULL::uuid, FALSE)
             ORDER BY COALESCE(sort_order, 999), label`,
            [c]
          );
          out[c] = rows.map((r) => ({ code: asText(r.code), label: asText(r.label) || asText(r.code) }));
        } catch {
          out[c] = [];
        }
      })
    );
    setLookups(out);
  }, []);

  const loadUsersAndApps = useCallback(async () => {
    try {
      const u = await runRows(
        `SELECT userid,
                COALESCE(displayname, firstname || ' ' || lastname, username) AS fullname,
                username
           FROM public.usr ORDER BY fullname LIMIT 500`
      );
      setUsers(u);
    } catch {
      /* non-fatal */
    }
    try {
      const a = await runRows(
        `SELECT instanceid, instancename, environment
           FROM public.applicationinstance ORDER BY instancename LIMIT 500`
      );
      setApps(a);
    } catch {
      /* non-fatal */
    }
    try {
      const tid = getNhiV2TenantId();
      const n = await runRows(
        `SELECT nhi_id, name, displayname, nhi_type
           FROM public.kf_nhi_identity
          WHERE tenant_id = ?::uuid
          ORDER BY name LIMIT 1000`,
        [tid]
      );
      setOtherNhis(n);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!nhiId) return;
    setErr(null);
    try {
      const tid = getNhiV2TenantId();
      const rows = await runRows(
        `SELECT i.*,
                u1.username AS owner_username, u1.firstname AS owner_firstname, u1.lastname AS owner_lastname,
                u2.username AS secondary_username,
                ai.instancename, ai.environment AS app_env,
                ap.vendor AS agent_vendor, ap.model_name AS agent_model,
                ap.model_version AS agent_model_version, ap.deployment_type,
                ap.requires_human_loop, ap.guardrails,
                ap.evaluation_score, ap.evaluation_as_of,
                ap.rate_limit_per_min AS ap_rate_pm, ap.rate_limit_per_hour AS ap_rate_ph,
                ap.token_budget_per_day AS ap_token_budget, ap.cost_budget_usd_daily AS ap_cost_budget,
                ap.context_window_tokens, ap.system_prompt_hash, ap.system_prompt_version,
                ap.safety_policy_version
           FROM public.kf_nhi_identity i
      LEFT JOIN public.usr u1 ON u1.userid    = i.ownerid
      LEFT JOIN public.usr u2 ON u2.userid    = i.secondary_ownerid
      LEFT JOIN public.applicationinstance ai ON ai.instanceid = i.instanceid
      LEFT JOIN public.kf_nhi_agent_profile ap ON ap.nhi_id = i.nhi_id
          WHERE i.tenant_id = ?::uuid AND i.nhi_id = ?::uuid`,
        [tid, nhiId]
      );
      setDetail(rows[0] || null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [nhiId]);

  const loadSections = useCallback(async () => {
    if (!nhiId) return;
    try {
      const [caps, eps, dels, secs, lineOut, lineIn, accs] = await Promise.all([
        runRows(
          `SELECT capability_id, tool_name, intent, tool_description, scope_filter,
                  risk_level, requires_approval, requires_delegation,
                  rate_limit_per_min, daily_call_budget, enabled, effective_to
             FROM public.kf_nhi_agent_capability
            WHERE nhi_id = ?::uuid
            ORDER BY enabled DESC, tool_name`,
          [nhiId]
        ),
        runRows(
          `SELECT endpoint_id, endpoint_type, endpoint_value, label, direction,
                  is_production, auth_mode, registered_by, approved_by,
                  effective_from, expires_at
             FROM public.kf_nhi_trusted_endpoint
            WHERE nhi_id = ?::uuid
            ORDER BY endpoint_type, endpoint_value`,
          [nhiId]
        ),
        runRows(
          `SELECT d.delegation_id, d.delegator_userid, d.intent, d.allowed_tools,
                  d.scope_filter, d.max_actions_per_day, d.max_amount_per_tx,
                  d.granted_at, d.expires_at, d.revoked_at, d.revoked_reason,
                  d.justification, d.approved_by,
                  u.username AS delegator_username,
                  COALESCE(u.firstname || ' ' || u.lastname, u.username) AS delegator_name
             FROM public.kf_nhi_agent_delegation d
        LEFT JOIN public.usr u ON u.userid = d.delegator_userid
            WHERE d.nhi_id = ?::uuid
            ORDER BY d.revoked_at NULLS FIRST, d.granted_at DESC`,
          [nhiId]
        ),
        runRows(
          `SELECT secret_id, secret_type, name, description,
                  vault_path, vault_provider, vault_version,
                  state, risk_level, fingerprint,
                  rotation_policy_days, last_rotated_at, next_rotation_at,
                  auto_rotate_enabled, mfa_bound, max_usage_per_day,
                  key_algorithm, key_length_bits, ip_allowlist, allowed_hours,
                  vault_sync_status, vault_last_synced, last_usage_count,
                  issued_at, expires_at, revoked_at
             FROM public.kf_nhi_secret
            WHERE nhi_id = ?::uuid
            ORDER BY state, secret_type, name`,
          [nhiId]
        ),
        runRows(
          `SELECT l.lineage_id, l.source_type, l.source_id, l.relation,
                  l.target_type, l.target_id, l.description, l.effective_from, l.effective_to,
                  ti.name AS target_nhi_name, ti.displayname AS target_nhi_displayname, ti.nhi_type AS target_nhi_type,
                  ai.instancename AS target_instancename,
                  u.username  AS target_username
             FROM public.kf_nhi_lineage l
        LEFT JOIN public.kf_nhi_identity     ti ON l.target_type = 'kf_nhi_identity'    AND ti.nhi_id = l.target_id
        LEFT JOIN public.applicationinstance ai ON l.target_type = 'applicationinstance' AND ai.instanceid = l.target_id
        LEFT JOIN public.usr                 u  ON l.target_type = 'usr'                 AND u.userid    = l.target_id
            WHERE l.source_type = 'kf_nhi_identity' AND l.source_id = ?::uuid
            ORDER BY l.effective_to NULLS FIRST, l.createddate DESC`,
          [nhiId]
        ),
        runRows(
          `SELECT l.lineage_id, l.source_type, l.source_id, l.relation,
                  l.target_type, l.target_id, l.description, l.effective_from, l.effective_to,
                  si.name AS source_nhi_name, si.displayname AS source_nhi_displayname, si.nhi_type AS source_nhi_type,
                  ai.instancename AS source_instancename,
                  u.username  AS source_username
             FROM public.kf_nhi_lineage l
        LEFT JOIN public.kf_nhi_identity     si ON l.source_type = 'kf_nhi_identity'    AND si.nhi_id = l.source_id
        LEFT JOIN public.applicationinstance ai ON l.source_type = 'applicationinstance' AND ai.instanceid = l.source_id
        LEFT JOIN public.usr                 u  ON l.source_type = 'usr'                 AND u.userid    = l.source_id
            WHERE l.target_type = 'kf_nhi_identity' AND l.target_id = ?::uuid
            ORDER BY l.effective_to NULLS FIRST, l.createddate DESC`,
          [nhiId]
        ),
        runRows(
          `SELECT na.nhi_account_id, na.accountid, na.is_primary, na.notes, na.createddate,
                  a.accountname, a.status AS account_status, a.instanceid,
                  ai.instancename
             FROM public.kf_nhi_account na
             JOIN public.account a  ON a.accountid = na.accountid
        LEFT JOIN public.applicationinstance ai ON ai.instanceid = a.instanceid
            WHERE na.nhi_id = ?::uuid
            ORDER BY na.is_primary DESC, ai.instancename`,
          [nhiId]
        ),
      ]);

      setCapabilities(caps);
      setEndpoints(eps);
      setDelegations(dels);
      setSecrets(secs);
      setLineage({ outbound: lineOut, inbound: lineIn });
      setNhiAccounts(accs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [nhiId]);

  const loadAudit = useCallback(async () => {
    if (!nhiId) return;
    try {
      const tid = getNhiV2TenantId();
      const rows = await runRows(
        `SELECT *
            FROM public.v_kf_nhi_combined_audit_log
           WHERE tenant_id = ?::uuid
             AND nhi_id   = ?::uuid
         ORDER BY createddate DESC
         LIMIT 200`,
        [tid, nhiId]
      );
      setAudit(rows);
    } catch {
      setAudit([]);
    }
  }, [nhiId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLookups(), loadUsersAndApps(), loadDetail(), loadSections()]).finally(() =>
      setLoading(false)
    );
  }, [loadLookups, loadUsersAndApps, loadDetail, loadSections]);

  useEffect(() => {
    if (tab === "audit") void loadAudit();
  }, [tab, loadAudit]);

  const flash = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setBanner({ kind, msg });
    setTimeout(() => setBanner(null), 3000);
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadDetail(), loadSections()]);
  }, [loadDetail, loadSections]);

  const onError = useCallback(
    (e: unknown) => flash(e instanceof Error ? e.message : String(e), "err"),
    [flash]
  );

  if (loading) {
    return (
      <div className={`${NHI2_PAGE_SHELL_CLASS} flex min-h-[200px] items-center justify-center text-sm text-slate-500`}>
        Loading NHI metadata…
      </div>
    );
  }

  if (err && !detail) {
    return (
      <div className={`${NHI2_PAGE_SHELL_CLASS} rounded-lg border border-red-200 bg-red-50 p-4`}>
        <p className="text-sm font-medium text-red-800">{err}</p>
        <button type="button" onClick={() => void reload()} className="mt-2 text-sm text-red-700 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={`${NHI2_PAGE_SHELL_CLASS} rounded-lg border border-slate-200 bg-white p-4`}>
        NHI not found.{" "}
        <Link href="/non-human-identity-2/nhis" className="text-blue-700 hover:underline">
          ← Back to inventory
        </Link>
      </div>
    );
  }

  const nhiType = asText(detail.nhi_type);
  const visibleTabs = TABS.filter((t) => {
    if (!("showFor" in t) || !t.showFor) return true;
    return (t.showFor as readonly string[]).includes(nhiType);
  });

  const tabCount = (key: string): number | null => {
    if (key === "capabilities") return capabilities.length || null;
    if (key === "endpoints") return endpoints.length || null;
    if (key === "delegations") return delegations.length || null;
    if (key === "credentials") return secrets.length || null;
    if (key === "relationships") {
      const n = lineage.inbound.length + lineage.outbound.length;
      return n || null;
    }
    if (key === "accounts") return nhiAccounts.length || null;
    return null;
  };

  return (
    <div className={`${NHI2_PAGE_SHELL_CLASS} space-y-4 pb-8`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-500">
            <Link href="/non-human-identity-2/nhis" className="hover:text-slate-700">
              ← NHI Inventory
            </Link>
            <span className="mx-1.5">·</span>
            <code className="text-[10.5px]">{asText(detail.nhi_id)}</code>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{asText(detail.displayname || detail.name)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip text={nhiType || "—"} />
            <Chip text={asText(detail.risk_level) || "medium"} className={riskChipClass(asText(detail.risk_level) || "medium")} />
            <Chip text={asText(detail.state) || "—"} />
            {asBool(detail.is_privileged) && <Chip text="privileged" className="bg-red-100 text-red-800" />}
            {asText(detail.criticality) && <Chip text={`criticality · ${asText(detail.criticality)}`} />}
            {asText(detail.instancename) && <Chip text={asText(detail.instancename)} />}
            {toArray(detail.tags).map((t) => (
              <Chip key={asText(t)} text={`#${asText(t)}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            banner.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {banner.msg}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((t) => {
          const count = tabCount(t.key);
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {t.label}
              {count != null && count > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <OverviewTab
          detail={detail}
          users={users}
          apps={apps}
          lookups={lookups}
          busy={busy}
          setBusy={setBusy}
          onSaved={(m) => {
            flash(m);
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "type" && (
        <TypeDetailsTab
          detail={detail}
          busy={busy}
          setBusy={setBusy}
          onSaved={(m) => {
            flash(m);
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "agent" && (
        <AgentProfileTab
          detail={detail}
          busy={busy}
          setBusy={setBusy}
          onSaved={(m) => {
            flash(m);
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "capabilities" && (
        <CapabilitiesBlock
          nhiId={nhiId}
          rows={capabilities}
          busy={busy}
          setBusy={setBusy}
          onChanged={() => {
            flash("Capability updated");
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "credentials" && (
        <CredentialsTab
          nhiId={nhiId}
          rows={secrets}
          lookups={lookups}
          busy={busy}
          setBusy={setBusy}
          onChanged={(m) => {
            flash(m);
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "relationships" && (
        <RelationshipsTab
          nhiId={nhiId}
          outbound={lineage.outbound}
          inbound={lineage.inbound}
          otherNhis={otherNhis}
          apps={apps}
          users={users}
          lookups={lookups}
          busy={busy}
          setBusy={setBusy}
          onChanged={(m) => {
            flash(m);
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "endpoints" && (
        <EndpointsBlock
          nhiId={nhiId}
          rows={endpoints}
          busy={busy}
          setBusy={setBusy}
          onChanged={() => {
            flash("Endpoint updated");
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "delegations" && (
        <DelegationsBlock
          nhiId={nhiId}
          rows={delegations}
          users={users}
          busy={busy}
          setBusy={setBusy}
          onChanged={() => {
            flash("Delegation updated");
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "accounts" && (
        <AccountsTab
          nhiId={nhiId}
          rows={nhiAccounts}
          busy={busy}
          setBusy={setBusy}
          onChanged={(m) => {
            flash(m);
            void reload();
          }}
          onError={onError}
        />
      )}
      {tab === "audit" && <AuditTab rows={audit} />}
    </div>
  );
}

/* ── Shared form primitives ── */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 mb-3 text-xs text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
      />
    </Field>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  renderOption?: (v: string) => string;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
      >
        {options.map((o) => (
          <option key={o || "__empty"} value={o}>
            {renderOption ? renderOption(o) : o || "—"}
          </option>
        ))}
      </select>
    </Field>
  );
}

function formFromDetail(d: Row) {
  return {
    displayname: asText(d.displayname),
    description: asText(d.description),
    state: asText(d.state),
    risk_level: asText(d.risk_level),
    is_privileged: !!d.is_privileged,
    ownerid: asText(d.ownerid),
    secondary_ownerid: asText(d.secondary_ownerid),
    instanceid: asText(d.instanceid),
    criticality: asText(d.criticality),
    execution_type: asText(d.execution_type),
    business_process: asText(d.business_process),
    business_function: asText(d.business_function),
    cost_center: asText(d.cost_center),
    org_unit: asText(d.org_unit),
    residency: asText(d.residency),
    data_classification: toArray(d.data_classification).map((x) => asText(x)).join(", "),
    tags: toArray(d.tags).map((x) => asText(x)).join(", "),
    expires_at: asText(d.expires_at),
    next_rotation: asText(d.next_rotation),
    last_used_at: asText(d.last_used_at),
    review_cycle_days: d.review_cycle_days ?? "",
    next_review_at: asText(d.next_review_at),
    review_status: asText(d.review_status),
    external_id: asText(d.external_id),
    external_source: asText(d.external_source),
    discovery_confidence: d.discovery_confidence ?? "",
    customattributes_text: JSON.stringify(toObject(d.customattributes), null, 2),
  };
}

/* ── Overview tab ── */

function OverviewTab({
  detail,
  users,
  apps,
  lookups,
  busy,
  setBusy,
  onSaved,
  onError,
}: {
  detail: Row;
  users: Row[];
  apps: Row[];
  lookups: Record<string, LookupOption[]>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState(() => formFromDetail(detail));
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setF(formFromDetail(detail));
    setDirty({});
  }, [detail]);

  const upd = (k: string, v: unknown) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setDirty((d) => ({ ...d, [k]: true }));
  };

  async function onSave() {
    if (Object.keys(dirty).length === 0) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const k of Object.keys(dirty)) {
        if (k === "tags") {
          payload.tags = String(f.tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (k === "data_classification") {
          payload.data_classification = String(f.data_classification)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (k === "customattributes_text") {
          try {
            payload.customattributes = JSON.parse(String(f.customattributes_text) || "{}");
          } catch {
            throw new Error("Custom attributes is not valid JSON");
          }
        } else if (f[k as keyof typeof f] === "" || f[k as keyof typeof f] === undefined) {
          payload[k] = null;
        } else {
          payload[k] = f[k as keyof typeof f];
        }
      }
      await runScalar(`SELECT public.kf_nhi_update_identity_v2(?::uuid, ?::jsonb, 'ui') AS result`, [
        asText(detail.nhi_id),
        JSON.stringify(payload),
      ]);
      setDirty({});
      onSaved("Overview saved");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  const stateOptions = optionsOrFallback(lookups.state, [
    "pending_approval",
    "active",
    "suspended",
    "rotating",
    "expiring_soon",
    "expired",
    "revoked",
    "decommissioned",
  ]);
  const riskOptions = optionsOrFallback(lookups.risk_level, ["critical", "high", "medium", "low", "informational"]);
  const reviewOptions = optionsOrFallback(lookups.review_status, [
    "not_due",
    "due",
    "in_review",
    "certified",
    "revoked",
    "risk_accepted",
    "overdue",
  ]);
  const criticalityOptions = optionsOrFallback(lookups.criticality, [
    "tier0_mission_critical",
    "tier1_critical",
    "tier2_important",
    "tier3_standard",
    "tier4_low",
  ]);
  const executionOptions = optionsOrFallback(lookups.execution_type, [
    "interactive",
    "batch",
    "event_driven",
    "scheduled",
    "reactive",
    "streaming",
  ]);
  const classOptions = optionsOrFallback(lookups.data_classification, [
    "public",
    "internal",
    "confidential",
    "restricted",
    "pii",
    "phi",
    "pci",
    "sox",
    "gdpr",
    "export_controlled",
  ]);

  const inputCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50";
  const selectCls = inputCls;

  return (
    <div>
      <Section title="Identity" subtitle="Core descriptors and ownership">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name (immutable)">
            <input className={inputCls} value={asText(detail.name)} disabled />
          </Field>
          <Field label="Display name">
            <input className={inputCls} value={String(f.displayname)} onChange={(e) => upd("displayname", e.target.value)} />
          </Field>
          <Field label="Type (immutable)">
            <input className={inputCls} value={asText(detail.nhi_type)} disabled />
          </Field>
          <Field label="Privileged?">
            <select
              className={selectCls}
              value={String(f.is_privileged)}
              onChange={(e) => upd("is_privileged", e.target.value === "true")}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
          <Field label="Primary owner" wide>
            <select className={selectCls} value={String(f.ownerid)} onChange={(e) => upd("ownerid", e.target.value)}>
              <option value="">— none —</option>
              {users.map((u) => (
                <option key={asText(u.userid)} value={asText(u.userid)}>
                  {asText(u.fullname) || asText(u.username)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Secondary owner" wide>
            <select
              className={selectCls}
              value={String(f.secondary_ownerid)}
              onChange={(e) => upd("secondary_ownerid", e.target.value)}
            >
              <option value="">— none —</option>
              {users.map((u) => (
                <option key={asText(u.userid)} value={asText(u.userid)}>
                  {asText(u.fullname) || asText(u.username)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Application instance" wide>
            <select className={selectCls} value={String(f.instanceid)} onChange={(e) => upd("instanceid", e.target.value)}>
              <option value="">— none —</option>
              {apps.map((a) => (
                <option key={asText(a.instanceid)} value={asText(a.instanceid)}>
                  {asText(a.instancename)}
                  {a.environment ? ` · ${asText(a.environment)}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description" wide>
            <textarea
              className={inputCls}
              rows={2}
              value={String(f.description)}
              onChange={(e) => upd("description", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Governance" subtitle="Business context, classification, residency">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="State">
            <select className={selectCls} value={String(f.state)} onChange={(e) => upd("state", e.target.value)}>
              <option value="">—</option>
              {stateOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Risk level">
            <select className={selectCls} value={String(f.risk_level)} onChange={(e) => upd("risk_level", e.target.value)}>
              <option value="">—</option>
              {riskOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Criticality">
            <select className={selectCls} value={String(f.criticality)} onChange={(e) => upd("criticality", e.target.value)}>
              <option value="">—</option>
              {criticalityOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Execution type">
            <select
              className={selectCls}
              value={String(f.execution_type)}
              onChange={(e) => upd("execution_type", e.target.value)}
            >
              <option value="">—</option>
              {executionOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <LabeledInput label="Business process" value={String(f.business_process)} onChange={(v) => upd("business_process", v)} placeholder="P2P, O2C, R2R…" />
          <LabeledInput label="Business function" value={String(f.business_function)} onChange={(v) => upd("business_function", v)} placeholder="Finance, Procurement…" />
          <LabeledInput label="Cost center" value={String(f.cost_center)} onChange={(v) => upd("cost_center", v)} />
          <LabeledInput label="Org unit" value={String(f.org_unit)} onChange={(v) => upd("org_unit", v)} placeholder="Team / department" />
          <LabeledInput label="Residency" value={String(f.residency)} onChange={(v) => upd("residency", v)} placeholder="us-east-1, EU, on-prem…" />
          <Field label="Data classification (comma-separated)" wide>
            <input
              className={inputCls}
              value={String(f.data_classification)}
              onChange={(e) => upd("data_classification", e.target.value)}
              placeholder={classOptions.map((o) => o.code).join(", ")}
            />
          </Field>
          <Field label="Tags (comma-separated)" wide>
            <input
              className={inputCls}
              value={String(f.tags)}
              onChange={(e) => upd("tags", e.target.value)}
              placeholder="prod, pci, sox-scope"
            />
          </Field>
        </div>
      </Section>

      <Section title="Lifecycle & review" subtitle="Expiry, rotation, recertification cadence">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Expires at">
            <input
              className={inputCls}
              type="datetime-local"
              value={toLocalDT(f.expires_at)}
              onChange={(e) => upd("expires_at", fromLocalDT(e.target.value))}
            />
          </Field>
          <Field label="Next rotation">
            <input
              className={inputCls}
              type="datetime-local"
              value={toLocalDT(f.next_rotation)}
              onChange={(e) => upd("next_rotation", fromLocalDT(e.target.value))}
            />
          </Field>
          <Field label="Last used at">
            <input
              className={inputCls}
              type="datetime-local"
              value={toLocalDT(f.last_used_at)}
              onChange={(e) => upd("last_used_at", fromLocalDT(e.target.value))}
            />
          </Field>
          <Field label="Review cycle (days)">
            <input
              className={inputCls}
              type="number"
              value={String(f.review_cycle_days)}
              onChange={(e) => upd("review_cycle_days", e.target.value)}
              placeholder="90"
            />
          </Field>
          <Field label="Next review at">
            <input
              className={inputCls}
              type="datetime-local"
              value={toLocalDT(f.next_review_at)}
              onChange={(e) => upd("next_review_at", fromLocalDT(e.target.value))}
            />
          </Field>
          <Field label="Review status">
            <select className={selectCls} value={String(f.review_status)} onChange={(e) => upd("review_status", e.target.value)}>
              <option value="">—</option>
              {reviewOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="External source" subtitle="Where this NHI was discovered or synced from">
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="External ID" value={String(f.external_id)} onChange={(v) => upd("external_id", v)} placeholder="AWS IAM Role ARN, Azure object ID…" />
          <LabeledInput label="External source" value={String(f.external_source)} onChange={(v) => upd("external_source", v)} placeholder="aws_iam, azure_ad, vault…" />
          <LabeledInput label="Discovery confidence (0–1)" value={String(f.discovery_confidence)} onChange={(v) => upd("discovery_confidence", v)} type="number" />
        </div>
      </Section>

      <Section title="Custom attributes" subtitle="Free-form JSONB bag — merged into the existing object on save">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={6}
          value={String(f.customattributes_text)}
          onChange={(e) => upd("customattributes_text", e.target.value)}
        />
      </Section>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-slate-500">
          {Object.keys(dirty).length === 0
            ? "No pending changes"
            : `${Object.keys(dirty).length} field${Object.keys(dirty).length === 1 ? "" : "s"} changed`}
        </span>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => void onSave()}
          disabled={busy || Object.keys(dirty).length === 0}
        >
          Save overview
        </button>
      </div>
    </div>
  );
}

/* ── Agent profile tab ── */

function AgentProfileTab({
  detail,
  busy,
  setBusy,
  onSaved,
  onError,
}: {
  detail: Row;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState({
    vendor: asText(detail.agent_vendor),
    model_name: asText(detail.agent_model),
    model_version: asText(detail.agent_model_version),
    deployment_type: asText(detail.deployment_type),
    requires_human_loop: !!detail.requires_human_loop,
    rate_limit_per_min: detail.ap_rate_pm ?? "",
    rate_limit_per_hour: detail.ap_rate_ph ?? "",
    token_budget_per_day: detail.ap_token_budget ?? "",
    cost_budget_usd_daily: detail.ap_cost_budget ?? "",
    context_window_tokens: detail.context_window_tokens ?? "",
    safety_policy_version: asText(detail.safety_policy_version),
    evaluation_score: detail.evaluation_score ?? "",
    system_prompt_hash: asText(detail.system_prompt_hash),
    system_prompt_version: asText(detail.system_prompt_version),
    guardrails_text: JSON.stringify(toObject(detail.guardrails), null, 2),
  });
  const upd = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function onSave() {
    setBusy(true);
    try {
      let guardrails: unknown;
      try {
        guardrails = JSON.parse(f.guardrails_text || "{}");
      } catch {
        throw new Error("Guardrails is not valid JSON");
      }

      await runRows(
        `INSERT INTO public.kf_nhi_agent_profile (
            nhi_id, vendor, model_name, model_version, deployment_type,
            requires_human_loop, rate_limit_per_min, rate_limit_per_hour,
            token_budget_per_day, cost_budget_usd_daily, context_window_tokens,
            safety_policy_version, evaluation_score,
            system_prompt_hash, system_prompt_version, guardrails, tenant_id)
         VALUES (?::uuid, ?, ?, ?, ?, ?::boolean,
                 NULLIF(?, '')::int, NULLIF(?, '')::int,
                 NULLIF(?, '')::bigint, NULLIF(?, '')::numeric,
                 NULLIF(?, '')::int, ?,
                 NULLIF(?, '')::numeric,
                 ?, ?, ?::jsonb,
                 (SELECT tenant_id FROM public.kf_nhi_identity WHERE nhi_id = ?::uuid))
         ON CONFLICT (nhi_id) DO UPDATE SET
            vendor = EXCLUDED.vendor,
            model_name = EXCLUDED.model_name,
            model_version = EXCLUDED.model_version,
            deployment_type = EXCLUDED.deployment_type,
            requires_human_loop = EXCLUDED.requires_human_loop,
            rate_limit_per_min = EXCLUDED.rate_limit_per_min,
            rate_limit_per_hour = EXCLUDED.rate_limit_per_hour,
            token_budget_per_day = EXCLUDED.token_budget_per_day,
            cost_budget_usd_daily = EXCLUDED.cost_budget_usd_daily,
            context_window_tokens = EXCLUDED.context_window_tokens,
            safety_policy_version = EXCLUDED.safety_policy_version,
            evaluation_score = EXCLUDED.evaluation_score,
            system_prompt_hash = EXCLUDED.system_prompt_hash,
            system_prompt_version = EXCLUDED.system_prompt_version,
            guardrails = EXCLUDED.guardrails,
            lastmodifieddate = now(),
            last_modified_by = 'ui'`,
        [
          asText(detail.nhi_id),
          f.vendor,
          f.model_name,
          f.model_version,
          f.deployment_type,
          f.requires_human_loop,
          String(f.rate_limit_per_min ?? ""),
          String(f.rate_limit_per_hour ?? ""),
          String(f.token_budget_per_day ?? ""),
          String(f.cost_budget_usd_daily ?? ""),
          String(f.context_window_tokens ?? ""),
          f.safety_policy_version,
          String(f.evaluation_score ?? ""),
          f.system_prompt_hash,
          f.system_prompt_version,
          JSON.stringify(guardrails),
          asText(detail.nhi_id),
        ]
      );
      onSaved("Agent profile saved");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div>
      <Section title="Model" subtitle="What powers this agent">
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="Vendor" value={f.vendor} onChange={(v) => upd("vendor", v)} placeholder="anthropic, openai, google…" />
          <LabeledInput label="Model name" value={f.model_name} onChange={(v) => upd("model_name", v)} placeholder="claude-sonnet-4.5, gpt-4o…" />
          <LabeledInput label="Model version" value={f.model_version} onChange={(v) => upd("model_version", v)} />
          <LabeledInput label="Deployment type" value={f.deployment_type} onChange={(v) => upd("deployment_type", v)} placeholder="hosted_api, private_cloud, on_prem, edge" />
          <LabeledInput label="Context window tokens" value={String(f.context_window_tokens)} onChange={(v) => upd("context_window_tokens", v)} type="number" />
          <Field label="Requires human loop?">
            <select
              className={inputCls}
              value={String(f.requires_human_loop)}
              onChange={(e) => upd("requires_human_loop", e.target.value === "true")}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Budgets" subtitle="Throughput & cost ceilings">
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="Rate limit / min" value={String(f.rate_limit_per_min)} onChange={(v) => upd("rate_limit_per_min", v)} type="number" />
          <LabeledInput label="Rate limit / hour" value={String(f.rate_limit_per_hour)} onChange={(v) => upd("rate_limit_per_hour", v)} type="number" />
          <LabeledInput label="Token budget / day" value={String(f.token_budget_per_day)} onChange={(v) => upd("token_budget_per_day", v)} type="number" />
          <LabeledInput label="Cost budget USD / day" value={String(f.cost_budget_usd_daily)} onChange={(v) => upd("cost_budget_usd_daily", v)} type="number" />
        </div>
      </Section>

      <Section title="Safety" subtitle="Evaluation score, prompt fingerprint, policy version">
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="Evaluation score (0–100)" value={String(f.evaluation_score)} onChange={(v) => upd("evaluation_score", v)} type="number" />
          <LabeledInput label="Safety policy version" value={f.safety_policy_version} onChange={(v) => upd("safety_policy_version", v)} />
          <LabeledInput label="System prompt hash" value={f.system_prompt_hash} onChange={(v) => upd("system_prompt_hash", v)} placeholder="sha256:…" />
          <LabeledInput label="System prompt version" value={f.system_prompt_version} onChange={(v) => upd("system_prompt_version", v)} />
        </div>
      </Section>

      <Section title="Guardrails (JSON)" subtitle='e.g. {"content_filter":"strict","pii_redaction":true}'>
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={8}
          value={f.guardrails_text}
          onChange={(e) => upd("guardrails_text", e.target.value)}
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => void onSave()}
          disabled={busy}
        >
          Save agent profile
        </button>
      </div>
    </div>
  );
}

/* ── Capabilities / Endpoints / Delegations blocks (from ServiceAccountsPage, nhiV2 API) ── */

function CapabilitiesBlock({
  nhiId,
  rows,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  nhiId: string;
  rows: Row[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    tool_name: "",
    intent: "read",
    risk_level: "medium",
    requires_approval: false,
    requires_delegation: true,
    rate_limit_per_min: "",
    daily_call_budget: "",
    scope_filter: "{}",
    tool_description: "",
  });

  const add = async () => {
    if (!form.tool_name.trim()) return;
    setBusy(true);
    try {
      const scope = JSON.parse(form.scope_filter || "{}");
      await runScalar(
        `SELECT public.kf_nhi_upsert_agent_capability(
           ?::uuid, ?, ?, ?, ?::jsonb, NULL, ?,
           ?::boolean, ?::boolean, ?::int, ?::int, TRUE, NULL, 'ui'
         ) AS r`,
        [
          nhiId,
          form.tool_name.trim(),
          form.intent,
          form.tool_description.trim() || null,
          JSON.stringify(scope),
          form.risk_level,
          form.requires_approval,
          form.requires_delegation,
          form.rate_limit_per_min ? Number(form.rate_limit_per_min) : null,
          form.daily_call_budget ? Number(form.daily_call_budget) : null,
        ]
      );
      setForm((p) => ({ ...p, tool_name: "", scope_filter: "{}", tool_description: "" }));
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const disable = async (capId: string) => {
    setBusy(true);
    try {
      await runScalar(`SELECT public.kf_nhi_disable_agent_capability(?::uuid, 'disabled from UI','ui') AS r`, [capId]);
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Allowed Capabilities / Intents</h2>
        <span className="ml-auto text-xs text-slate-500">
          {rows.length} total · {rows.filter((r) => asBool(r.enabled)).length} active
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LabeledInput label="Tool name" value={form.tool_name} onChange={(v) => setForm((p) => ({ ...p, tool_name: v }))} />
        <LabeledSelect label="Intent" value={form.intent} onChange={(v) => setForm((p) => ({ ...p, intent: v }))} options={INTENTS} />
        <LabeledSelect label="Risk level" value={form.risk_level} onChange={(v) => setForm((p) => ({ ...p, risk_level: v }))} options={RISKS} />
        <LabeledInput label="Rate/min" value={form.rate_limit_per_min} onChange={(v) => setForm((p) => ({ ...p, rate_limit_per_min: v }))} />
        <LabeledInput label="Daily budget" value={form.daily_call_budget} onChange={(v) => setForm((p) => ({ ...p, daily_call_budget: v }))} />
        <LabeledInput label="Description" value={form.tool_description} onChange={(v) => setForm((p) => ({ ...p, tool_description: v }))} />
      </div>
      <div className="mt-3">
        <LabeledInput label="Scope filter (JSON)" value={form.scope_filter} onChange={(v) => setForm((p) => ({ ...p, scope_filter: v }))} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-600">
          <input type="checkbox" checked={form.requires_approval} onChange={(e) => setForm((p) => ({ ...p, requires_approval: e.target.checked }))} /> requires approval
        </label>
        <label className="text-xs text-slate-600">
          <input type="checkbox" checked={form.requires_delegation} onChange={(e) => setForm((p) => ({ ...p, requires_delegation: e.target.checked }))} /> requires delegation
        </label>
        <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void add()} disabled={busy}>
          + Add capability
        </button>
      </div>
      <SimpleTable
        headers={["Tool", "Intent", "Risk", "Scope", "HITL", "Del", "/min", "/day", "State", ""]}
        rows={rows.map((r) => [
          asText(r.tool_name) || "—",
          <Badge key="i" text={asText(r.intent) || "—"} />,
          <Badge key="r" text={asText(r.risk_level) || "—"} tone="amber" />,
          asText(r.scope_filter) || "—",
          asBool(r.requires_approval) ? "✓" : "—",
          asBool(r.requires_delegation) ? "✓" : "—",
          asText(r.rate_limit_per_min) || "—",
          asText(r.daily_call_budget) || "—",
          asBool(r.enabled) ? <Badge key="s1" text="enabled" tone="green" /> : <Badge key="s0" text="disabled" />,
          asBool(r.enabled) ? (
            <button key="b" type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => void disable(asText(r.capability_id))} disabled={busy}>
              Disable
            </button>
          ) : (
            ""
          ),
        ])}
      />
    </section>
  );
}

function EndpointsBlock({
  nhiId,
  rows,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  nhiId: string;
  rows: Row[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    endpoint_type: "http_api",
    endpoint_value: "",
    label: "",
    auth_mode: "oauth2",
    is_production: true,
  });

  const add = async () => {
    if (!form.endpoint_value.trim()) return;
    setBusy(true);
    try {
      await runScalar(
        `SELECT public.kf_nhi_register_trusted_endpoint(
           ?::uuid, ?, ?, ?, ?, ?::boolean, ?, NULL, '{}'::jsonb, 'ui'
         ) AS r`,
        [
          nhiId,
          form.endpoint_type,
          form.endpoint_value.trim(),
          form.label.trim() || null,
          "outbound",
          form.is_production,
          form.auth_mode,
        ]
      );
      setForm((p) => ({ ...p, endpoint_value: "", label: "" }));
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Trusted Endpoints</h2>
        <span className="ml-auto text-xs text-slate-500">{rows.length} registered</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LabeledSelect label="Type" value={form.endpoint_type} onChange={(v) => setForm((p) => ({ ...p, endpoint_type: v }))} options={ENDPOINT_TYPES} />
        <LabeledInput label="Value (URL / RFC dest / host)" value={form.endpoint_value} onChange={(v) => setForm((p) => ({ ...p, endpoint_value: v }))} />
        <LabeledInput label="Label" value={form.label} onChange={(v) => setForm((p) => ({ ...p, label: v }))} />
        <LabeledSelect label="Auth mode" value={form.auth_mode} onChange={(v) => setForm((p) => ({ ...p, auth_mode: v }))} options={AUTH_MODES} />
        <div className="flex items-end">
          <label className="text-xs text-slate-600">
            <input type="checkbox" checked={form.is_production} onChange={(e) => setForm((p) => ({ ...p, is_production: e.target.checked }))} /> production
          </label>
        </div>
        <div className="flex items-end">
          <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void add()} disabled={busy}>
            + Register
          </button>
        </div>
      </div>
      <SimpleTable
        headers={["Type", "Value", "Label", "Dir", "Auth", "Prod", "Expires"]}
        rows={rows.map((r) => [
          <Badge key="t" text={asText(r.endpoint_type) || "—"} />,
          asText(r.endpoint_value) || "—",
          asText(r.label) || "—",
          asText(r.direction) || "—",
          asText(r.auth_mode) || "—",
          asBool(r.is_production) ? "✓" : "—",
          asText(r.expires_at) ? new Date(asText(r.expires_at)).toLocaleDateString() : "—",
        ])}
      />
    </section>
  );
}

function DelegationsBlock({
  nhiId,
  rows,
  users,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  nhiId: string;
  rows: Row[];
  users: Row[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    delegator_userid: "",
    intent: "read",
    allowed_tools: "",
    scope_filter: "{}",
    max_actions_per_day: "",
    max_amount_per_tx: "",
    expires_at: "",
    justification: "",
    approved_by: "",
  });

  const add = async () => {
    if (!form.delegator_userid) return;
    setBusy(true);
    try {
      JSON.parse(form.scope_filter || "{}");
      const tools = form.allowed_tools.split(",").map((s) => s.trim()).filter(Boolean);
      await runScalar(
        `SELECT public.kf_nhi_upsert_agent_delegation(
           ?::uuid, ?::uuid, ?,
           ?::text[],
           ?::jsonb,
           ?::int, ?::numeric,
           ?::timestamptz, ?::uuid, ?, 'ui'
         ) AS r`,
        [
          nhiId,
          form.delegator_userid,
          form.intent,
          `{${tools.join(",")}}`,
          form.scope_filter || "{}",
          form.max_actions_per_day ? Number(form.max_actions_per_day) : null,
          form.max_amount_per_tx ? Number(form.max_amount_per_tx) : null,
          form.expires_at || null,
          form.approved_by || null,
          form.justification.trim() || null,
        ]
      );
      setForm((p) => ({ ...p, allowed_tools: "", justification: "" }));
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Human → Agent Delegations (OBO)</h2>
        <span className="ml-auto text-xs text-slate-500">
          {rows.length} total · {rows.filter((r) => !r.revoked_at).length} active
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LabeledSelect
          label="Delegator (human)"
          value={form.delegator_userid}
          onChange={(v) => setForm((p) => ({ ...p, delegator_userid: v }))}
          options={["", ...users.map((u) => asText(u.userid))]}
          renderOption={(v) => (v ? asText(users.find((u) => asText(u.userid) === v)?.fullname) || v : "— pick user —")}
        />
        <LabeledSelect label="Intent" value={form.intent} onChange={(v) => setForm((p) => ({ ...p, intent: v }))} options={INTENTS} />
        <LabeledInput label="Allowed tools (comma)" value={form.allowed_tools} onChange={(v) => setForm((p) => ({ ...p, allowed_tools: v }))} />
        <LabeledInput label="Max actions / day" value={form.max_actions_per_day} onChange={(v) => setForm((p) => ({ ...p, max_actions_per_day: v }))} />
        <LabeledInput label="Max amount / tx" value={form.max_amount_per_tx} onChange={(v) => setForm((p) => ({ ...p, max_amount_per_tx: v }))} />
        <LabeledInput label="Expires at (ISO)" value={form.expires_at} onChange={(v) => setForm((p) => ({ ...p, expires_at: v }))} />
        <LabeledSelect
          label="Approved by"
          value={form.approved_by}
          onChange={(v) => setForm((p) => ({ ...p, approved_by: v }))}
          options={["", ...users.map((u) => asText(u.userid))]}
          renderOption={(v) => (v ? asText(users.find((u) => asText(u.userid) === v)?.fullname) || v : "—")}
        />
        <LabeledInput label="Scope filter (JSON)" value={form.scope_filter} onChange={(v) => setForm((p) => ({ ...p, scope_filter: v }))} />
        <LabeledInput label="Justification" value={form.justification} onChange={(v) => setForm((p) => ({ ...p, justification: v }))} />
      </div>
      <div className="mt-3">
        <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void add()} disabled={busy}>
          + Grant delegation
        </button>
      </div>
      <SimpleTable
        paginate
        initialPageSize={10}
        headers={["Delegator", "Intent", "Tools", "/day", "Max$", "Expires", "Status"]}
        rows={rows.map((r) => [
          asText(r.delegator_name) || asText(r.delegator_username) || "—",
          <Badge key="i" text={asText(r.intent) || "—"} />,
          Array.isArray(r.allowed_tools) ? (r.allowed_tools as unknown[]).join(", ") : "—",
          asText(r.max_actions_per_day) || "—",
          asText(r.max_amount_per_tx) || "—",
          asText(r.expires_at) ? new Date(asText(r.expires_at)).toLocaleDateString() : "—",
          r.revoked_at ? <Badge key="r" text="revoked" /> : <Badge key="a" text="active" tone="green" />,
        ])}
      />
    </section>
  );
}

function SimpleTable({
  headers,
  rows,
  paginate = false,
  initialPageSize = 10,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  paginate?: boolean;
  initialPageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = paginate ? rows.slice((safePage - 1) * pageSize, safePage * pageSize) : rows;

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {headers.map((h) => (
                <th key={h} className="px-2 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-2 py-3 text-slate-500">
                  No rows.
                </td>
              </tr>
            ) : (
              visibleRows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-slate-50/70">
                  {r.map((c, j) => (
                    <td key={j} className="px-2 py-2 align-top text-slate-700">
                      {c}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {paginate && rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-1 py-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              {rows.length} rows · page {safePage} / {totalPages}
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
              aria-label="Rows per page"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40">
              Prev
            </button>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Credentials tab ── */

function CredentialsTab({
  nhiId,
  rows,
  lookups,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  nhiId: string;
  rows: Row[];
  lookups: Record<string, LookupOption[]>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const secretTypeOpts = optionsOrFallback(lookups.secret_type, [
    "password",
    "api_key",
    "oauth_client_secret",
    "oauth_token",
    "jwt_signing_key",
    "ssh_private_key",
    "tls_certificate",
    "encryption_key",
    "connection_string",
    "saml_certificate",
    "other",
  ]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Vault-referenced secrets for this NHI. Values are never stored in the DB; only pointers (
          <code className="text-xs">vault_path</code>), rotation cadence, and hardening controls.
        </p>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}>
          {showAdd ? "Cancel" : "+ Add credential"}
        </button>
      </div>

      {showAdd && (
        <SecretAddForm
          nhiId={nhiId}
          types={secretTypeOpts}
          busy={busy}
          setBusy={setBusy}
          onDone={(m) => { setShowAdd(false); onChanged(m); }}
          onError={onError}
        />
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No credentials yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((s) => (
            <SecretCard
              key={asText(s.secret_id)}
              s={s}
              editing={editingId === asText(s.secret_id)}
              onStartEdit={() => setEditingId(asText(s.secret_id))}
              onCancel={() => setEditingId(null)}
              busy={busy}
              setBusy={setBusy}
              onChanged={(m) => { setEditingId(null); onChanged(m); }}
              onError={onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SecretAddForm({
  nhiId,
  types,
  busy,
  setBusy,
  onDone,
  onError,
}: {
  nhiId: string;
  types: LookupOption[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState({
    secret_type: types[0]?.code || "api_key",
    name: "",
    description: "",
    vault_path: "",
    vault_provider: "hashicorp",
    rotation_policy_days: "",
    expires_at: "",
    risk_level: "medium",
  });
  const upd = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  async function save() {
    if (!f.name) { onError(new Error("Secret name is required")); return; }
    setBusy(true);
    try {
      await runScalar(
        `SELECT public.kf_nhi_add_secret(
           ?::uuid, ?, ?, ?, ?, NULL::text,
           NULLIF(?, '')::int, NULLIF(?, '')::timestamptz,
           ?, ?, '{}'::jsonb, 'ui') AS result`,
        [nhiId, f.secret_type, f.name, f.vault_path, f.vault_provider, String(f.rotation_policy_days || ""), f.expires_at || "", f.description, f.risk_level]
      );
      onDone("Credential added");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Add credential</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Type">
          <select className={inputCls} value={f.secret_type} onChange={(e) => upd("secret_type", e.target.value)}>
            {types.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </Field>
        <LabeledInput label="Name" value={f.name} onChange={(v) => upd("name", v)} />
        <Field label="Risk level">
          <select className={inputCls} value={f.risk_level} onChange={(e) => upd("risk_level", e.target.value)}>
            {["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Vault provider">
          <select className={inputCls} value={f.vault_provider} onChange={(e) => upd("vault_provider", e.target.value)}>
            {["hashicorp", "aws_secrets_manager", "azure_keyvault", "gcp_secret_manager", "cyberark", "thycotic", "other"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Vault path" wide>
          <input className={inputCls} value={f.vault_path} onChange={(e) => upd("vault_path", e.target.value)} placeholder="secret/data/myapp/api-key" />
        </Field>
        <LabeledInput label="Rotation policy (days)" value={f.rotation_policy_days} onChange={(v) => upd("rotation_policy_days", v)} type="number" />
        <Field label="Expires at">
          <input className={inputCls} type="datetime-local" value={toLocalDT(f.expires_at)} onChange={(e) => upd("expires_at", fromLocalDT(e.target.value))} />
        </Field>
        <Field label="Description" wide>
          <input className={inputCls} value={f.description} onChange={(e) => upd("description", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void save()} disabled={busy}>Save credential</button>
      </div>
    </div>
  );
}

function secretForm(s: Row) {
  return {
    name: asText(s.name),
    description: asText(s.description),
    state: asText(s.state) || "active",
    risk_level: asText(s.risk_level) || "medium",
    vault_path: asText(s.vault_path),
    vault_provider: asText(s.vault_provider),
    vault_version: asText(s.vault_version),
    rotation_policy_days: s.rotation_policy_days ?? "",
    next_rotation_at: asText(s.next_rotation_at),
    expires_at: asText(s.expires_at),
    auto_rotate_enabled: !!s.auto_rotate_enabled,
    mfa_bound: !!s.mfa_bound,
    max_usage_per_day: s.max_usage_per_day ?? "",
    key_algorithm: asText(s.key_algorithm),
    key_length_bits: s.key_length_bits ?? "",
    allowed_hours: asText(s.allowed_hours),
    ip_allowlist: toArray(s.ip_allowlist).map((x) => asText(x)).join(", "),
  };
}

function SecretCard({
  s,
  editing,
  onStartEdit,
  onCancel,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  s: Row;
  editing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState(secretForm(s));
  useEffect(() => { setF(secretForm(s)); }, [s]);
  const upd = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  async function save() {
    setBusy(true);
    try {
      const updates = {
        name: f.name,
        description: f.description,
        state: f.state,
        risk_level: f.risk_level,
        vault_path: f.vault_path,
        vault_provider: f.vault_provider,
        vault_version: f.vault_version,
        rotation_policy_days: f.rotation_policy_days === "" ? null : Number(f.rotation_policy_days),
        next_rotation_at: f.next_rotation_at || null,
        expires_at: f.expires_at || null,
        auto_rotate_enabled: !!f.auto_rotate_enabled,
        mfa_bound: !!f.mfa_bound,
        max_usage_per_day: f.max_usage_per_day === "" ? null : Number(f.max_usage_per_day),
        key_algorithm: f.key_algorithm,
        key_length_bits: f.key_length_bits === "" ? null : Number(f.key_length_bits),
        allowed_hours: f.allowed_hours,
        ip_allowlist: String(f.ip_allowlist).split(",").map((x) => x.trim()).filter(Boolean),
      };
      await runScalar(`SELECT public.kf_nhi_update_secret(?::uuid, ?::jsonb, 'ui') AS result`, [asText(s.secret_id), JSON.stringify(updates)]);
      onChanged("Credential updated");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  async function rotate() {
    if (!confirm("Record a rotation event for this credential?")) return;
    setBusy(true);
    try {
      await runScalar(`SELECT public.kf_nhi_rotate_secret(?::uuid, NULL, NULL, NULL, 'ui') AS result`, [asText(s.secret_id)]);
      onChanged("Credential rotated");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  const rotOverdue = Boolean(s.next_rotation_at && new Date(asText(s.next_rotation_at)) < new Date());
  const expSoon = Boolean(s.expires_at && new Date(asText(s.expires_at)).getTime() - Date.now() < 30 * 24 * 3600 * 1000);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{asText(s.name)}</h3>
            <Chip text={asText(s.secret_type)} />
            <Chip text={asText(s.state)} />
            {rotOverdue && <Chip text="rotation overdue" className="bg-orange-100 text-orange-800" />}
            {expSoon && <Chip text="expiring soon" className="bg-amber-100 text-amber-800" />}
            {asBool(s.auto_rotate_enabled) && <Chip text="auto-rotate" className="bg-green-100 text-green-800" />}
          </div>
          <p className="mt-1 text-xs text-slate-500">{asText(s.description) || "—"}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => void rotate()} disabled={busy}>↻ Rotate now</button>
          {!editing ? (
            <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={onStartEdit}>Edit</button>
          ) : (
            <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          )}
        </div>
      </div>

      {!editing ? (
        <dl className="mt-3 grid max-w-3xl gap-x-4 gap-y-1 text-xs md:grid-cols-[auto_1fr]">
          <dt className="font-medium text-slate-500">vault</dt>
          <dd>{asText(s.vault_provider) || "—"} · {asText(s.vault_path) || "—"}{s.vault_version ? ` @ ${asText(s.vault_version)}` : ""}</dd>
          <dt className="font-medium text-slate-500">sync</dt>
          <dd>{asText(s.vault_sync_status) || "unknown"}{s.vault_last_synced ? ` · ${new Date(asText(s.vault_last_synced)).toLocaleString()}` : ""}</dd>
          <dt className="font-medium text-slate-500">rotation</dt>
          <dd>{s.rotation_policy_days ? `${asText(s.rotation_policy_days)} d` : "no policy"}; last {s.last_rotated_at ? new Date(asText(s.last_rotated_at)).toLocaleString() : "—"}; next {s.next_rotation_at ? new Date(asText(s.next_rotation_at)).toLocaleString() : "—"}</dd>
          <dt className="font-medium text-slate-500">hardening</dt>
          <dd>MFA {asBool(s.mfa_bound) ? "required" : "off"}; max/day {asText(s.max_usage_per_day) || "∞"}; IPs {toArray(s.ip_allowlist).join(", ") || "any"}</dd>
          <dt className="font-medium text-slate-500">fingerprint</dt>
          <dd>{asText(s.fingerprint) || "—"}</dd>
        </dl>
      ) : (
        <div className="mt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledInput label="Name" value={f.name} onChange={(v) => upd("name", v)} />
            <Field label="State">
              <select className={inputCls} value={f.state} onChange={(e) => upd("state", e.target.value)}>
                {["active", "suspended", "rotating", "expiring_soon", "expired", "revoked", "decommissioned"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Vault path" wide>
              <input className={inputCls} value={f.vault_path} onChange={(e) => upd("vault_path", e.target.value)} />
            </Field>
            <Field label="IP allow-list (comma)" wide>
              <input className={inputCls} value={String(f.ip_allowlist)} onChange={(e) => upd("ip_allowlist", e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void save()} disabled={busy}>Save credential</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Relationships tab ── */

function renderEdgeTarget(edge: Row, side: "source" | "target"): string {
  const type = asText(edge[`${side}_type`]);
  if (type === "kf_nhi_identity") {
    const name = asText(edge[`${side}_nhi_displayname`]) || asText(edge[`${side}_nhi_name`]);
    const t = asText(edge[`${side}_nhi_type`]);
    return `${t || "NHI"}: ${name || asText(edge[`${side}_id`]).slice(0, 8)}`;
  }
  if (type === "applicationinstance") {
    return `app: ${asText(edge[`${side}_instancename`]) || asText(edge[`${side}_id`]).slice(0, 8)}`;
  }
  if (type === "usr") {
    return `user: ${asText(edge[`${side}_username`]) || asText(edge[`${side}_id`]).slice(0, 8)}`;
  }
  return `${type || "?"}: ${asText(edge[`${side}_id`]).slice(0, 8)}`;
}

function RelationshipsTab({
  nhiId,
  outbound,
  inbound,
  otherNhis,
  apps,
  users,
  lookups,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  nhiId: string;
  outbound: Row[];
  inbound: Row[];
  otherNhis: Row[];
  apps: Row[];
  users: Row[];
  lookups: Record<string, LookupOption[]>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"list" | "graph">("list");
  const relOptions = optionsOrFallback(lookups.lineage_relation, [
    "owns", "uses", "delegates_to", "created_by", "rotated_by", "approved_by", "consumed_by",
  ]);

  async function removeEdge(lineage_id: string) {
    if (!confirm("Remove this relationship edge?")) return;
    setBusy(true);
    try {
      await runScalar(`SELECT public.kf_nhi_remove_lineage_edge(?::uuid, FALSE, 'ui') AS result`, [lineage_id]);
      onChanged("Edge removed");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Tracks who/what this NHI <b>talks to or depends on</b> (outbound) and who/what <b>talks to or relies on it</b> (inbound).
        </p>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add relationship"}
        </button>
      </div>

      {showAdd && (
        <RelationshipAddForm
          nhiId={nhiId}
          otherNhis={otherNhis}
          apps={apps}
          users={users}
          relOptions={relOptions}
          busy={busy}
          setBusy={setBusy}
          onDone={(m) => { setShowAdd(false); onChanged(m); }}
          onError={onError}
        />
      )}

      <div className="mb-3 flex gap-1 border-b border-slate-200">
        {(["list", "graph"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${view === k ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {k === "list" ? "List" : "Graph"}
            {k === "list" && outbound.length + inbound.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{outbound.length + inbound.length}</span>
            )}
          </button>
        ))}
      </div>

      {view === "graph" && <RelationshipGraph nhiId={nhiId} />}

      {view === "list" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Outbound — this NHI → target ({outbound.length})</h3>
            {outbound.length === 0 ? (
              <p className="text-xs text-slate-500">No outbound edges.</p>
            ) : (
              <ul className="space-y-2">
                {outbound.map((e) => (
                  <li key={asText(e.lineage_id)} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs">
                    <span>
                      this → <Chip text={asText(e.relation)} /> → {renderEdgeTarget(e, "target")}
                    </span>
                    {!e.effective_to && (
                      <button type="button" className="shrink-0 rounded border border-slate-300 px-2 py-1 hover:bg-slate-50" onClick={() => void removeEdge(asText(e.lineage_id))} disabled={busy}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Inbound — source → this NHI ({inbound.length})</h3>
            {inbound.length === 0 ? (
              <p className="text-xs text-slate-500">No inbound edges.</p>
            ) : (
              <ul className="space-y-2">
                {inbound.map((e) => (
                  <li key={asText(e.lineage_id)} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs">
                    <span>
                      {renderEdgeTarget(e, "source")} → <Chip text={asText(e.relation)} /> → this
                    </span>
                    {!e.effective_to && (
                      <button type="button" className="shrink-0 rounded border border-slate-300 px-2 py-1 hover:bg-slate-50" onClick={() => void removeEdge(asText(e.lineage_id))} disabled={busy}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function RelationshipAddForm({
  nhiId,
  otherNhis,
  apps,
  users,
  relOptions,
  busy,
  setBusy,
  onDone,
  onError,
}: {
  nhiId: string;
  otherNhis: Row[];
  apps: Row[];
  users: Row[];
  relOptions: LookupOption[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [f, setF] = useState({ target_kind: "kf_nhi_identity", target_id: "", relation: "uses", description: "" });
  const upd = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const options = useMemo(() => {
    switch (f.target_kind) {
      case "kf_nhi_identity":
        return otherNhis.filter((n) => asText(n.nhi_id) !== nhiId).map((n) => ({
          id: asText(n.nhi_id),
          label: `${asText(n.displayname || n.name)} · ${asText(n.nhi_type)}`,
        }));
      case "applicationinstance":
        return apps.map((a) => ({ id: asText(a.instanceid), label: `${asText(a.instancename) || "app"} · ${asText(a.environment) || "—"}` }));
      case "usr":
        return users.map((u) => ({ id: asText(u.userid), label: asText(u.fullname) || asText(u.username) }));
      default:
        return [];
    }
  }, [f.target_kind, otherNhis, apps, users, nhiId]);

  async function save() {
    if (!f.target_id) { onError(new Error("Pick a target")); return; }
    setBusy(true);
    try {
      const args = direction === "outbound"
        ? ["kf_nhi_identity", nhiId, f.relation, f.target_kind, f.target_id]
        : [f.target_kind, f.target_id, f.relation, "kf_nhi_identity", nhiId];
      await runScalar(
        `SELECT public.kf_nhi_add_lineage_edge(?, ?::uuid, ?, ?, ?::uuid, ?, '{}'::jsonb, 'ui') AS result`,
        [...args, f.description || null]
      );
      onDone("Relationship added");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Add relationship</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Direction">
          <select className={inputCls} value={direction} onChange={(e) => setDirection(e.target.value as "outbound" | "inbound")}>
            <option value="outbound">This NHI → target (outbound)</option>
            <option value="inbound">Source → this NHI (inbound)</option>
          </select>
        </Field>
        <Field label="Relation">
          <select className={inputCls} value={f.relation} onChange={(e) => upd("relation", e.target.value)}>
            {relOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </Field>
        <Field label={direction === "outbound" ? "Target kind" : "Source kind"}>
          <select className={inputCls} value={f.target_kind} onChange={(e) => upd("target_kind", e.target.value)}>
            <option value="kf_nhi_identity">Another NHI</option>
            <option value="applicationinstance">Application instance</option>
            <option value="usr">Human user</option>
          </select>
        </Field>
        <Field label={direction === "outbound" ? "Target" : "Source"} wide>
          <select className={inputCls} value={f.target_id} onChange={(e) => upd("target_id", e.target.value)}>
            <option value="">— pick one —</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Description" wide>
          <input className={inputCls} value={f.description} onChange={(e) => upd("description", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void save()} disabled={busy}>Save relationship</button>
      </div>
    </div>
  );
}

function RelationshipGraph({ nhiId }: { nhiId: string }) {
  const [depth, setDepth] = useState(2);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await runRows(`SELECT * FROM public.kf_nhi_lineage_walk(?::uuid, ?::int, 200)`, [nhiId, depth]);
        if (alive) setRows(r);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [nhiId, depth]);

  if (loading) return <p className="text-sm text-slate-500">Loading lineage…</p>;
  if (err) return <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>;
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No lineage edges yet. Use <b>+ Add relationship</b> above to wire this NHI into the graph.
      </div>
    );
  }

  const nodeMap = new Map<string, { id: string; label: string; type: string; lane: number }>();
  const edges: { key: string; source_id: string; target_id: string; relation: string }[] = [];
  const setNode = (id: string, data: { label: string; type: string; lane: number }) => {
    if (!id) return;
    const cur = nodeMap.get(id);
    if (!cur || Math.abs(data.lane) < Math.abs(cur.lane)) nodeMap.set(id, { id, ...data });
  };

  rows.forEach((r) => {
    if (asText(r.node_origin) === "Identity" || r.depth === 0) {
      setNode(asText(r.target_id), { label: asText(r.target_label), type: asText(r.target_node_type), lane: 0 });
      return;
    }
    const sign = asText(r.node_origin) === "Upstream" ? -1 : 1;
    const lane = sign * Number(r.depth);
    setNode(asText(r.target_id), { label: asText(r.target_label), type: asText(r.target_node_type), lane });
    if (r.source_id && !nodeMap.has(asText(r.source_id))) {
      setNode(asText(r.source_id), { label: asText(r.source_label), type: asText(r.source_node_type), lane: sign * Math.max(0, Number(r.depth) - 1) });
    }
    edges.push({ key: `${asText(r.source_id)}|${asText(r.edge_relation)}|${asText(r.target_id)}`, source_id: asText(r.source_id), target_id: asText(r.target_id), relation: asText(r.edge_relation) });
  });

  const nodes = Array.from(nodeMap.values());
  const lanesUsed = Array.from(new Set(nodes.map((n) => n.lane))).sort((a, b) => a - b);
  const COL_W = 200;
  const NODE_H = 26;
  const ROW_H = 36;
  const PAD_TOP = 32;
  const MARGIN = 30;
  const laneIndex = new Map(lanesUsed.map((l, i) => [l, i]));
  const colX = (lane: number) => MARGIN + (laneIndex.get(lane) ?? 0) * (COL_W + 40);
  const totalWidth = MARGIN + lanesUsed.length * (COL_W + 40);
  const byLane = new Map<number, typeof nodes>();
  nodes.forEach((n) => {
    if (!byLane.has(n.lane)) byLane.set(n.lane, []);
    byLane.get(n.lane)!.push(n);
  });
  byLane.forEach((arr) => arr.sort((a, b) => (a.label || "").localeCompare(b.label || "")));
  const maxNodesInLane = Math.max(...Array.from(byLane.values(), (arr) => arr.length));
  const totalHeight = PAD_TOP * 2 + Math.max(maxNodesInLane, 1) * ROW_H;
  const yFor = (lane: number, idxInLane: number) => {
    const arr = byLane.get(lane) ?? [];
    const offset = (totalHeight - PAD_TOP * 2 - arr.length * ROW_H) / 2;
    return PAD_TOP + offset + idxInLane * ROW_H + NODE_H / 2;
  };
  const nodePos = new Map<string, { x: number; y: number; lane: number }>();
  byLane.forEach((arr, lane) => {
    arr.forEach((n, i) => nodePos.set(n.id, { x: colX(lane), y: yFor(lane, i), lane }));
  });

  const relColor = (rel: string) =>
    ({ owns: "#3b82f6", uses: "#10b981", delegates_to: "#a855f7", consumed_by: "#9ca3af", created_by: "#06b6d4", rotated_by: "#f59e0b", approved_by: "#22c55e" }[rel] || "#6b7280");

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Lineage centred on this NHI</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Depth:</span>
          {[1, 2, 3].map((d) => (
            <button key={d} type="button" onClick={() => setDepth(d)} className={`rounded px-2.5 py-1 text-xs font-medium ${depth === d ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{d}</button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">{nodes.length} nodes · {edges.length} edges · depth {depth}</p>
      <svg width={totalWidth} height={totalHeight} className="rounded-md bg-slate-50">
        {lanesUsed.map((lane) => (
          <text key={`lh-${lane}`} x={colX(lane) + COL_W / 2} y={16} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="600">
            {lane === 0 ? "FOCAL" : lane < 0 ? `UPSTREAM ${lane}` : `DOWNSTREAM +${lane}`}
          </text>
        ))}
        {edges.map((e) => {
          const s = nodePos.get(e.source_id);
          const t = nodePos.get(e.target_id);
          if (!s || !t) return null;
          const x1 = s.lane <= t.lane ? s.x + COL_W : s.x;
          const x2 = s.lane <= t.lane ? t.x : t.x + COL_W;
          return (
            <g key={e.key}>
              <line x1={x1} y1={s.y} x2={x2} y2={t.y} stroke={relColor(e.relation)} strokeWidth={1.5} opacity={0.6} />
              <text x={(x1 + x2) / 2} y={(s.y + t.y) / 2 - 4} textAnchor="middle" fontSize="9" fill={relColor(e.relation)}>{e.relation}</text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = nodePos.get(n.id);
          if (!p) return null;
          const isFocal = n.lane === 0;
          return (
            <g key={n.id}>
              <rect x={p.x} y={p.y - NODE_H / 2} width={COL_W} height={NODE_H} rx={isFocal ? 8 : 6} fill={isFocal ? "#4f46e5" : "#fff"} stroke={isFocal ? "#4f46e5" : "#cbd5e1"} strokeWidth={isFocal ? 0 : 1} />
              <text x={p.x + 8} y={p.y + 4} fontSize="11" fontWeight={isFocal ? 600 : 400} fill={isFocal ? "#fff" : "#1a1a2e"}>
                {String(n.label || n.id.slice(0, 8)).slice(0, 26)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Accounts tab ── */

function AccountsTab({
  nhiId,
  rows,
  busy,
  setBusy,
  onChanged,
  onError,
}: {
  nhiId: string;
  rows: Row[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [options, setOptions] = useState<Row[]>([]);
  const [f, setF] = useState({ accountid: "", is_primary: false, notes: "" });
  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  useEffect(() => {
    (async () => {
      try {
        const r = await runRows(
          `SELECT a.accountid, a.accountname, a.status, ai.instancename
             FROM public.account a
        LEFT JOIN public.applicationinstance ai ON ai.instanceid = a.instanceid
            WHERE a.accountid NOT IN (SELECT accountid FROM public.kf_nhi_account WHERE nhi_id = ?::uuid)
            ORDER BY ai.instancename, a.accountname LIMIT 500`,
          [nhiId]
        );
        setOptions(r);
      } catch { /* non-fatal */ }
    })();
  }, [nhiId, rows]);

  async function link() {
    if (!f.accountid) { onError(new Error("Pick an account")); return; }
    setBusy(true);
    try {
      await runScalar(`SELECT public.kf_nhi_link_account(?::uuid, ?::uuid, ?::boolean, ?, 'ui') AS result`, [nhiId, f.accountid, f.is_primary, f.notes || null]);
      setF({ accountid: "", is_primary: false, notes: "" });
      setShowAdd(false);
      onChanged("Account linked");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  async function unlink(nhi_account_id: string) {
    if (!confirm("Unlink this account?")) return;
    setBusy(true);
    try {
      await runRows(`DELETE FROM public.kf_nhi_account WHERE nhi_account_id = ?::uuid`, [nhi_account_id]);
      onChanged("Account unlinked");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">IGA accounts linked to this NHI for entitlement inheritance and access-review reporting.</p>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Link account"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Account" wide>
              <select className={inputCls} value={f.accountid} onChange={(e) => setF({ ...f, accountid: e.target.value })}>
                <option value="">— pick one —</option>
                {options.map((o) => (
                  <option key={asText(o.accountid)} value={asText(o.accountid)}>
                    {asText(o.accountname)}{o.instancename ? ` · ${asText(o.instancename)}` : ""}{o.status ? ` · ${asText(o.status)}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Primary?">
              <select className={inputCls} value={String(f.is_primary)} onChange={(e) => setF({ ...f, is_primary: e.target.value === "true" })}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
            <Field label="Notes" wide>
              <input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void link()} disabled={busy}>Link account</button>
          </div>
        </div>
      )}

      <SimpleTable
        headers={["Account", "Application", "Status", "Primary", "Notes", "Linked", ""]}
        rows={rows.map((r) => [
          asText(r.accountname) || "—",
          asText(r.instancename) || "—",
          asText(r.account_status) || "—",
          asBool(r.is_primary) ? "✓" : "—",
          asText(r.notes) || "—",
          r.createddate ? new Date(asText(r.createddate)).toLocaleDateString() : "—",
          <button key="u" type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => void unlink(asText(r.nhi_account_id))} disabled={busy}>Unlink</button>,
        ])}
      />
    </div>
  );
}

/* ── Audit tab ── */

function AuditTab({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No audit events yet.</div>;
  }

  const palette: Record<string, { bg: string; fg: string }> = {
    identity: { bg: "#eef2ff", fg: "#4338ca" },
    secret: { bg: "#fee2e2", fg: "#991b1b" },
    capability: { bg: "#dcfce7", fg: "#166534" },
    delegation: { bg: "#fef3c7", fg: "#92400e" },
    endpoint: { bg: "#e0f2fe", fg: "#075985" },
    account: { bg: "#f3e8ff", fg: "#6b21a8" },
    owner_assignment: { bg: "#fce7f3", fg: "#9d174d" },
  };

  return (
    <SimpleTable
      paginate
      initialPageSize={50}
      headers={["When", "Scope", "Action", "Actor", "Actor type", "Changes"]}
      rows={rows.map((r) => {
        const scope = asText(r.child_kind) || "identity";
        const p = palette[scope] || { bg: "#f3f4f6", fg: "#374151" };
        const changes = r.changes;
        return [
          r.createddate ? new Date(asText(r.createddate)).toLocaleString() : "—",
          <span key="s" style={{ background: p.bg, color: p.fg, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>{scope}</span>,
          <Badge key="a" text={asText(r.action) || "—"} tone={["deleted", "revoked"].includes(asText(r.action)) ? "red" : asText(r.action) === "created" ? "green" : "slate"} />,
          asText(r.actor_id) || "—",
          asText(r.actor_type) || "—",
          <code key="c" className="block max-w-md whitespace-pre-wrap break-words text-[10.5px]">
            {changes == null ? "—" : typeof changes === "string" ? changes : JSON.stringify(changes)}
          </code>,
        ];
      })}
    />
  );
}

/* ── Type Details tab ── */

function TypeDetailsTab({
  detail,
  busy,
  setBusy,
  onSaved,
  onError,
}: {
  detail: Row;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: (m: string) => void;
  onError: (e: unknown) => void;
}) {
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const nhiId = asText(detail.nhi_id);
  const nhiType = asText(detail.nhi_type);
  const ca = toObject(detail.customattributes);
  const identityBlock = (ca.identity as Record<string, unknown> | undefined) ?? {};
  const typeBlk = (identityBlock[nhiType] as Record<string, unknown> | undefined) ?? {};
  const vaultBlk = (ca.vault as Record<string, unknown> | undefined) ?? {};

  useEffect(() => {
    if (!nhiType) return;
    let alive = true;
    (async () => {
      try {
        const rows = await runRows(`SELECT public.kf_nhi_get_attribute_schema(?::text, NULL::uuid) AS schema`, [nhiType]);
        let raw: unknown = rows[0]?.schema;
        if (typeof raw === "string") {
          try { raw = JSON.parse(raw); } catch { raw = null; }
        }
        if (alive) setSchema((raw as Record<string, unknown>) || null);
      } catch (e) {
        if (alive) setLoadErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [nhiType]);

  useEffect(() => {
    if (!schema || !Array.isArray(schema.fields)) return;
    const caLocal = toObject(detail.customattributes);
    const identityBlockLocal = (caLocal.identity as Record<string, unknown> | undefined) ?? {};
    const typeBlkLocal = (identityBlockLocal[nhiType] as Record<string, unknown> | undefined) ?? {};
    const vaultBlkLocal = (caLocal.vault as Record<string, unknown> | undefined) ?? {};

    const v: Record<string, unknown> = {};
    (schema.fields as Record<string, unknown>[]).forEach((f) => {
      const src = asText(f.source);
      const key = asText(f.key);
      if (src.startsWith("customattributes.")) {
        const parts = src.split(".").slice(1);
        let cur: unknown = caLocal;
        for (const p of parts) cur = (cur as Record<string, unknown>)?.[p];
        v[key] = cur;
      } else if (src.startsWith("kf_nhi_secret.")) {
        v[key] = vaultBlkLocal[src.split(".")[1]];
      } else if (src.startsWith("kf_nhi_trusted_endpoint.") || src.startsWith("kf_nhi_agent_profile.")) {
        v[key] = typeBlkLocal[key] ?? null;
      } else if (src.startsWith("kf_nhi_identity.")) {
        v[key] = detail[src.split(".")[1]];
      } else {
        v[key] = typeBlkLocal[key];
      }
    });
    setValues(v);
  }, [schema, nhiType, detail]);

  if (loadErr) return <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</div>;
  if (!schema) return <p className="text-sm text-slate-500">Loading type schema…</p>;

  const fields = schema.fields as Record<string, unknown>[] | undefined;
  if (!Array.isArray(fields) || fields.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No type-specific schema found for <code className="text-xs">{nhiType}</code>.
      </p>
    );
  }

  const schemaFields = fields;

  const groups = [...((schema.groups as Record<string, unknown>[]) || [])].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0)
  );
  const fieldsByGroup = (gk: string) => schemaFields.filter((f) => asText(f.group) === gk);
  const updField = (k: string, val: unknown) => setValues((p) => ({ ...p, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      const newTypeBlk = { ...typeBlk };
      const newVaultBlk = { ...vaultBlk };
      schemaFields.forEach((f) => {
        const src = asText(f.source);
        const v = values[asText(f.key)];
        if (src.startsWith("kf_nhi_secret.")) {
          newVaultBlk[src.split(".")[1]] = v;
        } else {
          newTypeBlk[asText(f.key)] = v;
        }
      });
      const newCA = { ...ca, identity: { ...identityBlock, [nhiType]: newTypeBlk } };
      if (Object.keys(newVaultBlk).length > 0) (newCA as Record<string, unknown>).vault = newVaultBlk;
      await runScalar(`SELECT public.kf_nhi_save_nhi_attributes_min(?::uuid, ?::jsonb, 'ui') AS r`, [nhiId, JSON.stringify(newCA)]);
      onSaved("Type-specific attributes saved");
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Type-specific attributes for <b>{nhiType}</b>. Schema lives in <code className="text-xs">kf_nhi_lookup.metadata.attribute_schema</code>.
      </p>
      {groups.map((g) => {
        const flds = fieldsByGroup(asText(g.key));
        if (flds.length === 0) return null;
        return (
          <section key={asText(g.key)} className="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{asText(g.label)}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {flds.map((f) => (
                <Field key={asText(f.key)} label={`${asText(f.label)}${f.required ? " *" : ""}`} wide={f.kind === "jsonb" || f.kind === "string_array"}>
                  <FieldInput field={f} value={values[asText(f.key)]} onChange={(v) => updField(asText(f.key), v)} busy={busy} />
                  {asText(f.help) && <p className="mt-1 text-[11px] text-slate-500">{asText(f.help)}</p>}
                </Field>
              ))}
            </div>
          </section>
        );
      })}
      <div className="flex justify-end">
        <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void save()} disabled={busy}>Save type details</button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  busy,
}: {
  field: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  busy: boolean;
}) {
  const k = asText(field.kind) || "text";
  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50";

  if (k === "text") {
    return <input className={inputCls} value={asText(value)} disabled={busy} placeholder={asText(field.placeholder)} onChange={(e) => onChange(e.target.value)} />;
  }
  if (k === "int" || k === "decimal") {
    return <input className={inputCls} type="number" step={k === "decimal" ? "0.01" : undefined} value={value == null ? "" : String(value)} disabled={busy} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  }
  if (k === "bool") {
    return <input type="checkbox" checked={!!value} disabled={busy} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (k === "date") {
    return <input className={inputCls} type="date" value={value ? String(value).slice(0, 10) : ""} disabled={busy} onChange={(e) => onChange(e.target.value || null)} />;
  }
  if (k === "string_array") {
    const v = Array.isArray(value) ? value.join(", ") : asText(value);
    return <input className={inputCls} value={v} disabled={busy} placeholder="comma, separated" onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />;
  }
  if (k === "jsonb") {
    const txt = value && typeof value === "object" ? JSON.stringify(value, null, 2) : asText(value);
    return (
      <textarea className={`${inputCls} font-mono text-xs`} rows={5} value={txt} disabled={busy} placeholder='{ "key": "value" }' onChange={(e) => {
        try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
      }} />
    );
  }
  if (k === "lookup") {
    return <LookupField category={asText(field.lookup_category)} value={value} onChange={onChange} busy={busy} />;
  }
  return <input className={inputCls} value={asText(value)} disabled={busy} onChange={(e) => onChange(e.target.value)} />;
}

function LookupField({
  category,
  value,
  onChange,
  busy,
}: {
  category: string;
  value: unknown;
  onChange: (v: unknown) => void;
  busy: boolean;
}) {
  const [opts, setOpts] = useState<LookupOption[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await runRows(
          `SELECT code, label FROM public.kf_nhi_lookup_options(?::varchar, NULL::uuid, FALSE)
           ORDER BY COALESCE(sort_order, 999), label`,
          [category]
        );
        if (alive) setOpts(rows.map((r) => ({ code: asText(r.code), label: asText(r.label) || asText(r.code) })));
      } catch { /* non-fatal */ }
    })();
    return () => { alive = false; };
  }, [category]);

  return (
    <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50" value={asText(value)} disabled={busy} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— pick —</option>
      {opts.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}
