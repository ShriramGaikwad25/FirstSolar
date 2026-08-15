"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { executeQuery } from "@/lib/api";
import { extractResultRows } from "@/lib/nhi-dashboard";
import { RotateCw } from "lucide-react";
import { NhiCreateForm } from "@/components/non-human-identity/NhiCreateForm";

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";
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
const NHI_TYPES_FOR_LCM = [
  "service_account",
  "agent",
  "managed_identity",
  "oauth_client",
  "bot",
  "scheduled_job",
];

type Row = Record<string, unknown>;

async function runRows(query: string, parameters: unknown[] = []): Promise<Row[]> {
  const resp = await executeQuery<unknown>(query, parameters);
  return extractResultRows(resp);
}

async function runScalar(query: string, parameters: unknown[] = []): Promise<unknown> {
  const rows = await runRows(query, parameters);
  const first = rows[0];
  if (!first) return null;
  const firstKey = Object.keys(first)[0];
  return firstKey ? first[firstKey] : null;
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

export type ServiceAccountsPageProps = {
  /** When set: show only this NHI, hide identity sidebar (e.g. AI Agent Details). */
  embeddedNhiId?: string | null;
  pageHeading?: string;
  showIdentitySidebar?: boolean;
  /** Create-account CTA + long subtitle (off for embedded agent detail). */
  showServiceAccountChrome?: boolean;
  /** Hide top title block (parent page supplies heading + tabs). */
  suppressPageHeader?: boolean;
};

export function ServiceAccountsPage(props: ServiceAccountsPageProps = {}) {
  const {
    embeddedNhiId = null,
    pageHeading,
    showIdentitySidebar = true,
    showServiceAccountChrome = true,
    suppressPageHeader = false,
  } = props;
  const [identities, setIdentities] = useState<Row[]>([]);
  const [focalId, setFocalId] = useState(embeddedNhiId ?? "");
  const [detail, setDetail] = useState<Row | null>(null);
  const [capabilities, setCapabilities] = useState<Row[]>([]);
  const [endpoints, setEndpoints] = useState<Row[]>([]);
  const [delegations, setDelegations] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (embeddedNhiId) return;
    if (searchParams.get("create") === "1" && showIdentitySidebar) {
      router.replace("/non-human-identity/create-nhi");
    }
  }, [embeddedNhiId, searchParams, showIdentitySidebar, router]);

  const loadList = useCallback(async () => {
    if (!showIdentitySidebar) return;
    const rows = await runRows(
      `SELECT nhi_id, name, displayname, nhi_type, state, risk_level,
              is_privileged, load_source
         FROM public.kf_nhi_identity
        WHERE tenant_id = ?::uuid
          AND nhi_type IN ('service_account','agent','managed_identity','oauth_client','bot','scheduled_job')
        ORDER BY name
        LIMIT 500`,
      [TENANT_ID]
    );
    setIdentities(rows);
    if (!focalId && rows.length) setFocalId(asText(rows[0].nhi_id));
  }, [focalId, showIdentitySidebar]);

  const loadUsers = useCallback(async () => {
    const rows = await runRows(
      `SELECT userid, COALESCE(firstname || ' ' || lastname, username) AS fullname, username
         FROM public.usr
        ORDER BY fullname
        LIMIT 500`,
      []
    );
    setUsers(rows);
  }, []);

  const loadDetailForId = useCallback(async (id: string) => {
    if (!id) return;
    const [d, caps, eps, dels] = await Promise.all([
      runRows(
        `SELECT i.nhi_id, i.name, i.displayname, i.description, i.nhi_type, i.state,
                i.risk_level, i.is_privileged, i.tags, i.customattributes,
                i.ownerid, i.instanceid, i.external_id, i.external_source,
                i.createddate, i.expires_at,
                u.username AS owner_username, ai.instancename,
                ap.vendor AS agent_vendor, ap.model_name AS agent_model,
                ap.requires_human_loop, ap.guardrails
           FROM public.kf_nhi_identity i
           LEFT JOIN public.usr u  ON u.userid = i.ownerid
           LEFT JOIN public.applicationinstance ai ON ai.instanceid = i.instanceid
           LEFT JOIN public.kf_nhi_agent_profile ap ON ap.nhi_id = i.nhi_id
          WHERE i.tenant_id = ?::uuid AND i.nhi_id = ?::uuid`,
        [TENANT_ID, id]
      ),
      runRows(
        `SELECT capability_id, tool_name, intent, tool_description, scope_filter,
                risk_level, requires_approval, requires_delegation,
                rate_limit_per_min, daily_call_budget, enabled, effective_to
           FROM public.kf_nhi_agent_capability
          WHERE nhi_id = ?::uuid
          ORDER BY enabled DESC, tool_name`,
        [id]
      ),
      runRows(
        `SELECT endpoint_id, endpoint_type, endpoint_value, label, direction,
                is_production, auth_mode, last_verified_at
           FROM public.kf_nhi_trusted_endpoint
          WHERE nhi_id = ?::uuid
          ORDER BY endpoint_type, endpoint_value`,
        [id]
      ),
      runRows(
        `SELECT d.delegation_id, d.intent, d.allowed_tools, d.scope_filter,
                d.max_actions_per_day, d.max_amount_per_tx,
                d.granted_at, d.expires_at, d.revoked_at, d.justification,
                COALESCE(ud.firstname || ' ' || ud.lastname, ud.username) AS delegator_name,
                COALESCE(ua.firstname || ' ' || ua.lastname, ua.username) AS approver_name
           FROM public.kf_nhi_agent_delegation d
           LEFT JOIN public.usr ud ON ud.userid = d.delegator_userid
           LEFT JOIN public.usr ua ON ua.userid = d.approved_by
          WHERE d.nhi_id = ?::uuid
          ORDER BY d.granted_at DESC`,
        [id]
      ),
    ]);
    setDetail(d[0] ?? null);
    setCapabilities(caps);
    setEndpoints(eps);
    setDelegations(dels);
  }, []);

  const loadDetail = useCallback(async () => {
    if (!focalId) return;
    await loadDetailForId(focalId);
  }, [focalId, loadDetailForId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadUsers();
        if (showIdentitySidebar) await loadList();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load service accounts");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadList, loadUsers, showIdentitySidebar]);

  useEffect(() => {
    const id = (embeddedNhiId?.trim() || focalId?.trim() || "") as string;
    if (!id) return;
    (async () => {
      setDetailLoading(true);
      setError(null);
      try {
        if (embeddedNhiId?.trim()) setFocalId(embeddedNhiId.trim());
        await loadDetailForId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load identity details");
        setDetail(null);
        setCapabilities([]);
        setEndpoints([]);
        setDelegations([]);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [embeddedNhiId, focalId, loadDetailForId]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading service accounts…</div>;
  if (!showIdentitySidebar && detailLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading agent details…</div>;
  }

  const heading = pageHeading ?? "Service Accounts & Agents";

  return (
    <div className="w-full space-y-4 pb-8">
      {!suppressPageHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
            {showServiceAccountChrome && (
              <p className="mt-1 text-sm text-slate-600">
                Create and manage metadata, capabilities, trusted endpoints, and delegations.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-50"
              aria-label="Refresh"
              title="Refresh"
              onClick={async () => {
                try {
                  setError(null);
                  await Promise.all([
                    showIdentitySidebar ? loadList() : Promise.resolve(),
                    loadDetail(),
                  ]);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Refresh failed");
                }
              }}
            >
              <RotateCw className="h-4 w-4" />
            </button>
            {showServiceAccountChrome && showIdentitySidebar && (
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                onClick={() => setShowCreate(true)}
              >
                + Create Service Account
              </button>
            )}
          </div>
        </div>
      )}

      {suppressPageHeader && (
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-50"
            aria-label="Refresh"
            title="Refresh"
            onClick={async () => {
              try {
                setError(null);
                await loadDetail();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Refresh failed");
              }
            }}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className={showIdentitySidebar ? "flex items-start gap-4" : undefined}>
        {showIdentitySidebar && (
        <aside className="sticky top-[72px] h-[calc(100vh-96px)] w-80 shrink-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Identities ({identities.length})
          </div>
          <ul className="h-[calc(100%-28px)] space-y-2 overflow-auto pr-1">
            {identities.map((i) => {
              const id = asText(i.nhi_id);
              const active = focalId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setFocalId(id)}
                    className={`w-full rounded border px-3 py-2 text-left ${
                      active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="truncate text-sm font-semibold text-slate-900">{asText(i.name) || "—"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {asText(i.nhi_type)} · {asText(i.state)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        )}

        <div className={`min-w-0 space-y-4 ${showIdentitySidebar ? "flex-1" : "w-full"}`}>
          {!detail && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-slate-500">
              {embeddedNhiId
                ? "No identity record was returned for this agent ID. It may be missing from kf_nhi_identity for this tenant, or the ID from the inventory list does not match."
                : "Pick an identity from the list."}
            </div>
          )}
          {detail && (
            <>
              <IdentityMetadata detail={detail} users={users} busy={busy} setBusy={setBusy} onSaved={loadDetail} onError={setError} />
              <CapabilitiesBlock nhiId={asText(detail.nhi_id)} rows={capabilities} busy={busy} setBusy={setBusy} onChanged={loadDetail} onError={setError} />
              <EndpointsBlock nhiId={asText(detail.nhi_id)} rows={endpoints} busy={busy} setBusy={setBusy} onChanged={loadDetail} onError={setError} />
              <DelegationsBlock nhiId={asText(detail.nhi_id)} rows={delegations} users={users} busy={busy} setBusy={setBusy} onChanged={loadDetail} onError={setError} />
            </>
          )}
        </div>
      </section>

      {showCreate && showIdentitySidebar && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 pt-[10vh]"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="max-h-[82vh] w-[min(960px,94vw)] overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Create service account</h3>
              <button
                type="button"
                className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                onClick={() => setShowCreate(false)}
              >
                ✕
              </button>
            </div>
            <NhiCreateForm
              users={users}
              onSuccess={async (newId) => {
                setShowCreate(false);
                setError(null);
                await loadList();
                if (newId) setFocalId(newId);
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function IdentityMetadata({
  detail,
  busy,
  setBusy,
  onSaved,
  onError,
}: {
  detail: Row;
  users: Row[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
  onError: (s: string | null) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    displayname: "",
    description: "",
    risk_level: "medium",
    state: "active",
    tags: "",
  });
  const [customJson, setCustomJson] = useState("{}");

  useEffect(() => {
    const tags = Array.isArray(detail.tags) ? (detail.tags as unknown[]).map((x) => String(x)) : [];
    setForm({
      displayname: asText(detail.displayname),
      description: asText(detail.description),
      risk_level: asText(detail.risk_level) || "medium",
      state: asText(detail.state) || "active",
      tags: tags.join(", "),
    });
    setCustomJson(JSON.stringify(detail.customattributes ?? {}, null, 2));
  }, [detail]);

  const save = async () => {
    setBusy(true);
    onError(null);
    try {
      const updates = {
        displayname: form.displayname || null,
        description: form.description || null,
        state: form.state,
        risk_level: form.risk_level,
        tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
      };
      await runScalar(`SELECT public.kf_nhi_update_identity(?::uuid, ?::jsonb, 'ui') AS r`, [
        asText(detail.nhi_id),
        JSON.stringify(updates),
      ]);

      let parsed: unknown = {};
      try {
        parsed = JSON.parse(customJson || "{}");
      } catch (e) {
        throw new Error(`customattributes must be valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      await runScalar(
        `SELECT public.kf_nhi_set_customattributes(?::uuid, ?::jsonb, FALSE, 'ui') AS r`,
        [asText(detail.nhi_id), JSON.stringify(parsed)]
      );
      setEdit(false);
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Metadata</h2>
        <Badge text={asText(detail.nhi_type) || "—"} />
        <Badge text={asText(detail.risk_level) || "—"} tone="amber" />
        {asBool(detail.is_privileged) && <Badge text="privileged" tone="red" />}
        <div className="ml-auto flex gap-2">
          {edit ? (
            <>
              <button className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700" onClick={save} disabled={busy}>
                Save
              </button>
              <button className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" onClick={() => setEdit(false)} disabled={busy}>
                Cancel
              </button>
            </>
          ) : (
            <button className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" onClick={() => setEdit(true)}>
              Edit metadata
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <LabeledInput label="Name" value={asText(detail.name)} disabled />
        <LabeledInput label="Display name" value={form.displayname} disabled={!edit} onChange={(v) => setForm((p) => ({ ...p, displayname: v }))} />
        <LabeledSelect label="State" value={form.state} disabled={!edit} onChange={(v) => setForm((p) => ({ ...p, state: v }))} options={["active", "suspended", "revoked", "decommissioned", "pending_approval", "expired"]} />
        <LabeledSelect label="Risk level" value={form.risk_level} disabled={!edit} onChange={(v) => setForm((p) => ({ ...p, risk_level: v }))} options={RISKS} />
        <LabeledInput label="Owner" value={asText(detail.owner_username) || "—"} disabled />
        <LabeledInput label="Hosted on" value={asText(detail.instancename) || "—"} disabled />
      </div>

      <div className="mt-3 grid gap-3">
        <LabeledInput label="Description" value={form.description} disabled={!edit} onChange={(v) => setForm((p) => ({ ...p, description: v }))} />
        <LabeledInput label="Tags (comma separated)" value={form.tags} disabled={!edit} onChange={(v) => setForm((p) => ({ ...p, tags: v }))} />
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Custom attributes (JSONB)</label>
          <textarea
            value={customJson}
            disabled={!edit}
            onChange={(e) => setCustomJson(e.target.value)}
            className="h-36 w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </section>
  );
}

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
  onChanged: () => Promise<void>;
  onError: (s: string | null) => void;
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
    onError(null);
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
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Add capability failed");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (capId: string) => {
    setBusy(true);
    onError(null);
    try {
      await runScalar(`SELECT public.kf_nhi_disable_agent_capability(?::uuid, 'disabled from UI','ui') AS r`, [capId]);
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Disable capability failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
        <label className="text-xs text-slate-600"><input type="checkbox" checked={form.requires_approval} onChange={(e) => setForm((p) => ({ ...p, requires_approval: e.target.checked }))} /> requires approval</label>
        <label className="text-xs text-slate-600"><input type="checkbox" checked={form.requires_delegation} onChange={(e) => setForm((p) => ({ ...p, requires_delegation: e.target.checked }))} /> requires delegation</label>
        <button className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50" onClick={add} disabled={busy}>
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
            <button key="b" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => disable(asText(r.capability_id))} disabled={busy}>
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
  onChanged: () => Promise<void>;
  onError: (s: string | null) => void;
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
    onError(null);
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
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Register endpoint failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
          <label className="text-xs text-slate-600"><input type="checkbox" checked={form.is_production} onChange={(e) => setForm((p) => ({ ...p, is_production: e.target.checked }))} /> production</label>
        </div>
        <div className="flex items-end">
          <button className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50" onClick={add} disabled={busy}>
            + Register
          </button>
        </div>
      </div>
      <SimpleTable
        headers={["Type", "Value", "Label", "Dir", "Auth", "Prod", "Verified"]}
        rows={rows.map((r) => [
          <Badge key="t" text={asText(r.endpoint_type) || "—"} />,
          asText(r.endpoint_value) || "—",
          asText(r.label) || "—",
          asText(r.direction) || "—",
          asText(r.auth_mode) || "—",
          asBool(r.is_production) ? "✓" : "—",
          asText(r.last_verified_at) ? new Date(asText(r.last_verified_at)).toLocaleDateString() : "—",
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
  onChanged: () => Promise<void>;
  onError: (s: string | null) => void;
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
    onError(null);
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
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Grant delegation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
        <button className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50" onClick={add} disabled={busy}>
          + Grant delegation
        </button>
      </div>

      <SimpleTable
        paginate
        initialPageSize={10}
        headers={["Delegator", "Intent", "Tools", "/day", "Max$", "Expires", "Approver", "Status"]}
        rows={rows.map((r) => [
          asText(r.delegator_name) || "—",
          <Badge key="i" text={asText(r.intent) || "—"} />,
          Array.isArray(r.allowed_tools) ? (r.allowed_tools as unknown[]).join(", ") : "—",
          asText(r.max_actions_per_day) || "—",
          asText(r.max_amount_per_tx) || "—",
          asText(r.expires_at) ? new Date(asText(r.expires_at)).toLocaleDateString() : "—",
          asText(r.approver_name) || "—",
          r.revoked_at ? <Badge key="r" text="revoked" /> : <Badge key="a" text="active" tone="green" />,
        ])}
      />
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
      />
    </div>
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
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
      >
        {options.map((o) => (
          <option key={o || "__empty"} value={o}>
            {renderOption ? renderOption(o) : o || "—"}
          </option>
        ))}
      </select>
    </div>
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
  const visibleRows = paginate
    ? rows.slice((safePage - 1) * pageSize, safePage * pageSize)
    : rows;

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
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

