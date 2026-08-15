"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { executeQuery } from "@/lib/api";
import { extractResultRows } from "@/lib/nhi-dashboard";

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";
const RISKS = ["low", "medium", "high", "critical"];
const NHI_TYPES_FOR_LCM = [
  "service_account",
  "agent",
  "managed_identity",
  "oauth_client",
  "bot",
  "scheduled_job",
];

const AC_TYPE_OPTIONS = ["Service Account", "API Key", "Webhook", "SSH", "Cloud Managed Identity"];
const BASIC_IDENTITY_TYPE_OPTIONS = ["Application", "Infrastructure", "Cloud"];
const ENVIRONMENT_OPTIONS = ["Dev", "Test", "Prod"];
const STATUS_LIFECYCLE_OPTIONS = ["Created", "Active", "Dormant", "Locked", "Decommissioned"];
const CREDENTIAL_TYPE_OPTIONS = ["Password", "Secret", "API Key", "Certificate", "OAuth", "Token"];
const CREDENTIAL_STATUS_OPTIONS = ["Initial", "Active", "Expired", "Locked", "Revoked"];
const EXECUTION_TYPE_OPTIONS = ["Scheduled", "Event Driven", "On Demand"];
const TRIGGER_MECHANISM_OPTIONS = ["Time", "Event"];
const FREQUENCY_OPTIONS = ["Daily", "Hourly", "Event based"];
const AUDIT_FLAG_OPTIONS = ["Yes", "No"];

type Row = Record<string, unknown>;

export type IdentityAttributeFormState = {
  basic: {
    user_id_account_id: string;
    ac_type: string;
    identity_type: string;
    description_purpose: string;
    created_on: string;
    created_by: string;
    business_owner: string;
    technical_owner_custodian: string;
    application_system: string;
    environment: string;
    status_lifecycle: string;
  };
  lifecycle: {
    start_date: string;
    expiry_date: string;
    review_status: string;
    last_reviewed_date: string;
    next_review_date: string;
  };
  security: {
    credential_type: string;
    credential_status: string;
    credential_store: string;
    recent_credential_update: string;
    rotation_policy: string;
    risk: string;
    data_sensitivity: string;
    audit_flag: string;
  };
  execution: {
    authorized_users_sme_users: string;
    execution_type: string;
    invocation_source: string;
    trigger_mechanism: string;
    frequency: string;
    associated_linked_object: string;
    dependency_dependent_system: string;
  };
  business: {
    business_process: string;
    regulatory_scope: string;
    cost_center: string;
  };
};

function emptyIdentityForm(): IdentityAttributeFormState {
  return {
    basic: {
      user_id_account_id: "",
      ac_type: "",
      identity_type: "",
      description_purpose: "",
      created_on: "",
      created_by: "",
      business_owner: "",
      technical_owner_custodian: "",
      application_system: "",
      environment: "",
      status_lifecycle: "",
    },
    lifecycle: {
      start_date: "",
      expiry_date: "",
      review_status: "",
      last_reviewed_date: "",
      next_review_date: "",
    },
    security: {
      credential_type: "",
      credential_status: "",
      credential_store: "",
      recent_credential_update: "",
      rotation_policy: "",
      risk: "medium",
      data_sensitivity: "",
      audit_flag: "",
    },
    execution: {
      authorized_users_sme_users: "",
      execution_type: "",
      invocation_source: "",
      trigger_mechanism: "",
      frequency: "",
      associated_linked_object: "",
      dependency_dependent_system: "",
    },
    business: {
      business_process: "",
      regulatory_scope: "",
      cost_center: "",
    },
  };
}

function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out;
}

function splitToList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Matches `customattributes.identity` used on NHI Inventory detail. */
export function buildCustomAttributesFromIdentityForm(identity: IdentityAttributeFormState): string {
  const basic = pruneEmpty({
    user_id_account_id: identity.basic.user_id_account_id.trim(),
    ac_type: identity.basic.ac_type.trim(),
    identity_type: identity.basic.identity_type.trim(),
    description_purpose: identity.basic.description_purpose.trim(),
    created_on: identity.basic.created_on.trim(),
    created_by: identity.basic.created_by.trim(),
    business_owner: identity.basic.business_owner.trim(),
    technical_owner_custodian: identity.basic.technical_owner_custodian.trim(),
    application_system: identity.basic.application_system.trim(),
    environment: identity.basic.environment.trim(),
    status_lifecycle: identity.basic.status_lifecycle.trim(),
  });

  const lifecycle = pruneEmpty({
    start_date: identity.lifecycle.start_date.trim(),
    expiry_date: identity.lifecycle.expiry_date.trim(),
    review_status: identity.lifecycle.review_status.trim(),
    last_reviewed_date: identity.lifecycle.last_reviewed_date.trim(),
    next_review_date: identity.lifecycle.next_review_date.trim(),
  });

  const security = pruneEmpty({
    credential_type: identity.security.credential_type.trim(),
    credential_status: identity.security.credential_status.trim(),
    credential_store: identity.security.credential_store.trim(),
    recent_credential_update: identity.security.recent_credential_update.trim(),
    rotation_policy: identity.security.rotation_policy.trim(),
    risk: identity.security.risk.trim(),
    data_sensitivity: identity.security.data_sensitivity.trim(),
    audit_flag: identity.security.audit_flag.trim(),
  });

  const sme = splitToList(identity.execution.authorized_users_sme_users);
  const execution = pruneEmpty({
    authorized_users_sme_users: sme.length ? sme : undefined,
    execution_type: identity.execution.execution_type.trim(),
    invocation_source: identity.execution.invocation_source.trim(),
    trigger_mechanism: identity.execution.trigger_mechanism.trim(),
    frequency: identity.execution.frequency.trim(),
    associated_linked_object: identity.execution.associated_linked_object.trim(),
    dependency_dependent_system: identity.execution.dependency_dependent_system.trim(),
  });

  const regulatory = splitToList(identity.business.regulatory_scope);
  const business = pruneEmpty({
    business_process: identity.business.business_process.trim(),
    regulatory_scope: regulatory.length ? regulatory : undefined,
    cost_center: identity.business.cost_center.trim(),
  });

  const inner: Record<string, unknown> = {};
  if (Object.keys(basic).length) inner.basic_attributes = basic;
  if (Object.keys(lifecycle).length) inner.lifecycle_attributes = lifecycle;
  if (Object.keys(security).length) inner.security_attributes = security;
  if (Object.keys(execution).length) inner.execution_context = execution;
  if (Object.keys(business).length) inner.business_context = business;

  return JSON.stringify({ identity: inner });
}

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

function riskLabel(v: string): string {
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function FormLabeledInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
      />
    </div>
  );
}

function FormLabeledTextarea({
  label,
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <div className="md:col-span-2">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
      />
    </div>
  );
}

function FormLabeledSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  renderOption,
  allowEmpty = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  renderOption?: (v: string) => string;
  allowEmpty?: boolean;
}) {
  const opts =
    !allowEmpty ? options : options.includes("") ? options : ["", ...options];
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
      >
        {opts.map((o, i) => (
          <option key={`${label}:${i}`} value={o}>
            {o === "" ? "—" : renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}

export type NhiCreateFormProps = {
  /** When provided, skips loading users inside the form. */
  users?: Row[];
  onSuccess: (nhiId: string | null) => void | Promise<void>;
  onCancel?: () => void;
  /** Inline: optional small heading. Page: main H1 (defaults to “Create new NHI”). */
  title?: string;
  /** Wrap in a white card with padding (full page). */
  variant?: "inline" | "page";
};

export function NhiCreateForm({
  users: usersProp,
  onSuccess,
  onCancel,
  title,
  variant = "inline",
}: NhiCreateFormProps) {
  const [users, setUsers] = useState<Row[]>(usersProp ?? []);
  const [usersLoading, setUsersLoading] = useState(!usersProp?.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [core, setCore] = useState({
    name: "",
    displayname: "",
    nhi_type: "service_account",
    ownerid: "",
    tags: "",
    create_agent: false,
    agent_vendor: "anthropic",
    agent_model: "claude-sonnet-4.5",
    requires_human_loop: true,
  });
  const [identity, setIdentity] = useState<IdentityAttributeFormState>(() => emptyIdentityForm());

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

  useEffect(() => {
    if (usersProp && usersProp.length > 0) {
      setUsers(usersProp);
      setUsersLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        await loadUsers();
      } catch {
        if (!cancelled) setError("Failed to load users");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usersProp, loadUsers]);

  const submit = async () => {
    if (!core.name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const customattributes = buildCustomAttributesFromIdentityForm(identity);
      const tags = core.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const description =
        identity.basic.description_purpose.trim() || core.displayname.trim() || null;
      const riskRaw = identity.security.risk.trim().toLowerCase();
      const risk_level = RISKS.includes(riskRaw) ? riskRaw : "medium";
      const r = await runScalar(
        `SELECT public.kf_nhi_create_service_account(
           ?::uuid, ?, ?, ?, ?,
           ?::uuid, NULL, NULL, NULL,
           ?, FALSE, ?::text[], ?::jsonb, NULL,
           ?::boolean, ?, ?, ?::boolean, '{}'::jsonb, 'ui'
         ) AS r`,
        [
          TENANT_ID,
          core.name.trim(),
          core.nhi_type,
          core.displayname.trim() || null,
          description,
          core.ownerid || null,
          risk_level,
          `{${tags.join(",")}}`,
          customattributes,
          core.create_agent,
          core.create_agent ? core.agent_vendor : null,
          core.create_agent ? core.agent_model : null,
          core.requires_human_loop,
        ]
      );
      const newId =
        typeof r === "object" && r && "nhi_id" in (r as Record<string, unknown>)
          ? asText((r as Record<string, unknown>).nhi_id)
          : null;
      await onSuccess(newId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const grid = "grid gap-4 md:grid-cols-2";

  const formBody = (
    <>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {usersLoading && <p className="mb-3 text-sm text-slate-500">Loading users…</p>}

      <div className={`${grid} mb-6`}>
        <FormLabeledInput label="Name *" value={core.name} onChange={(v) => setCore((p) => ({ ...p, name: v }))} disabled={busy} />
        <FormLabeledInput
          label="Display name"
          value={core.displayname}
          onChange={(v) => setCore((p) => ({ ...p, displayname: v }))}
          disabled={busy}
        />
        <FormLabeledSelect
          label="NHI type (system)"
          value={core.nhi_type}
          onChange={(v) => setCore((p) => ({ ...p, nhi_type: v }))}
          options={NHI_TYPES_FOR_LCM}
          disabled={busy}
          allowEmpty={false}
        />
        <FormLabeledSelect
          label="Owner"
          value={core.ownerid}
          onChange={(v) => setCore((p) => ({ ...p, ownerid: v }))}
          options={users.map((u) => asText(u.userid))}
          renderOption={(v) => (v ? asText(users.find((u) => asText(u.userid) === v)?.fullname) || v : "—")}
          disabled={busy || usersLoading}
        />
        <FormLabeledInput
          label="Tags (comma-separated)"
          value={core.tags}
          onChange={(v) => setCore((p) => ({ ...p, tags: v }))}
          disabled={busy}
        />
      </div>

      <div className="space-y-6">
        <FormSection title="Basic attributes">
          <div className={grid}>
            <FormLabeledInput
              label="User ID / Account ID"
              value={identity.basic.user_id_account_id}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, user_id_account_id: v } }))}
              disabled={busy}
            />
            <FormLabeledSelect
              label="A/C type"
              value={identity.basic.ac_type}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, ac_type: v } }))}
              options={AC_TYPE_OPTIONS}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Identity type"
              value={identity.basic.identity_type}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, identity_type: v } }))}
              options={BASIC_IDENTITY_TYPE_OPTIONS}
              disabled={busy}
            />
            <FormLabeledTextarea
              label="Description / purpose"
              value={identity.basic.description_purpose}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, description_purpose: v } }))}
              disabled={busy}
              rows={3}
            />
            <FormLabeledInput
              label="Created on"
              type="date"
              value={identity.basic.created_on}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, created_on: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Created by"
              value={identity.basic.created_by}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, created_by: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Business owner"
              value={identity.basic.business_owner}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, business_owner: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Technical owner / custodian"
              value={identity.basic.technical_owner_custodian}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, technical_owner_custodian: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Application / system"
              value={identity.basic.application_system}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, application_system: v } }))}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Environment"
              value={identity.basic.environment}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, environment: v } }))}
              options={ENVIRONMENT_OPTIONS}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Status / lifecycle"
              value={identity.basic.status_lifecycle}
              onChange={(v) => setIdentity((p) => ({ ...p, basic: { ...p.basic, status_lifecycle: v } }))}
              options={STATUS_LIFECYCLE_OPTIONS}
              disabled={busy}
            />
          </div>
        </FormSection>

        <FormSection title="Lifecycle attributes">
          <div className={grid}>
            <FormLabeledInput
              label="Start date"
              type="date"
              value={identity.lifecycle.start_date}
              onChange={(v) => setIdentity((p) => ({ ...p, lifecycle: { ...p.lifecycle, start_date: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Expiry date"
              type="date"
              value={identity.lifecycle.expiry_date}
              onChange={(v) => setIdentity((p) => ({ ...p, lifecycle: { ...p.lifecycle, expiry_date: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Review status"
              value={identity.lifecycle.review_status}
              onChange={(v) => setIdentity((p) => ({ ...p, lifecycle: { ...p.lifecycle, review_status: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Last reviewed date"
              type="date"
              value={identity.lifecycle.last_reviewed_date}
              onChange={(v) => setIdentity((p) => ({ ...p, lifecycle: { ...p.lifecycle, last_reviewed_date: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Next review date"
              type="date"
              value={identity.lifecycle.next_review_date}
              onChange={(v) => setIdentity((p) => ({ ...p, lifecycle: { ...p.lifecycle, next_review_date: v } }))}
              disabled={busy}
            />
          </div>
        </FormSection>

        <FormSection title="Security attributes">
          <div className={grid}>
            <FormLabeledSelect
              label="Credential type"
              value={identity.security.credential_type}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, credential_type: v } }))}
              options={CREDENTIAL_TYPE_OPTIONS}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Credential status"
              value={identity.security.credential_status}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, credential_status: v } }))}
              options={CREDENTIAL_STATUS_OPTIONS}
              disabled={busy}
            />
            <FormLabeledInput
              label="Credential store"
              value={identity.security.credential_store}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, credential_store: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Recent credential update"
              type="date"
              value={identity.security.recent_credential_update}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, recent_credential_update: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Rotation policy"
              value={identity.security.rotation_policy}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, rotation_policy: v } }))}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Risk"
              value={identity.security.risk}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, risk: v } }))}
              options={RISKS}
              disabled={busy}
              allowEmpty={false}
              renderOption={riskLabel}
            />
            <FormLabeledInput
              label="Data sensitivity"
              value={identity.security.data_sensitivity}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, data_sensitivity: v } }))}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Audit flag"
              value={identity.security.audit_flag}
              onChange={(v) => setIdentity((p) => ({ ...p, security: { ...p.security, audit_flag: v } }))}
              options={AUDIT_FLAG_OPTIONS}
              disabled={busy}
            />
          </div>
        </FormSection>

        <FormSection title="Execution context">
          <div className={grid}>
            <FormLabeledTextarea
              label="Authorized users / SME users"
              value={identity.execution.authorized_users_sme_users}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, authorized_users_sme_users: v } }))}
              disabled={busy}
              rows={2}
            />
            <FormLabeledSelect
              label="Execution type"
              value={identity.execution.execution_type}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, execution_type: v } }))}
              options={EXECUTION_TYPE_OPTIONS}
              disabled={busy}
            />
            <FormLabeledInput
              label="Invocation source"
              value={identity.execution.invocation_source}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, invocation_source: v } }))}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Trigger mechanism"
              value={identity.execution.trigger_mechanism}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, trigger_mechanism: v } }))}
              options={TRIGGER_MECHANISM_OPTIONS}
              disabled={busy}
            />
            <FormLabeledSelect
              label="Frequency"
              value={identity.execution.frequency}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, frequency: v } }))}
              options={FREQUENCY_OPTIONS}
              disabled={busy}
            />
            <FormLabeledInput
              label="Associated / linked object / process / job / app"
              value={identity.execution.associated_linked_object}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, associated_linked_object: v } }))}
              disabled={busy}
            />
            <FormLabeledInput
              label="Dependency / dependent system"
              value={identity.execution.dependency_dependent_system}
              onChange={(v) => setIdentity((p) => ({ ...p, execution: { ...p.execution, dependency_dependent_system: v } }))}
              disabled={busy}
            />
          </div>
        </FormSection>

        <FormSection title="Business context">
          <div className={grid}>
            <FormLabeledInput
              label="Business process"
              value={identity.business.business_process}
              onChange={(v) => setIdentity((p) => ({ ...p, business: { ...p.business, business_process: v } }))}
              disabled={busy}
            />
            <FormLabeledTextarea
              label="Regulatory scope"
              value={identity.business.regulatory_scope}
              onChange={(v) => setIdentity((p) => ({ ...p, business: { ...p.business, regulatory_scope: v } }))}
              disabled={busy}
              rows={2}
            />
            <FormLabeledInput
              label="Cost center"
              value={identity.business.cost_center}
              onChange={(v) => setIdentity((p) => ({ ...p, business: { ...p.business, cost_center: v } }))}
              disabled={busy}
            />
          </div>
        </FormSection>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={core.create_agent}
            onChange={(e) => setCore((p) => ({ ...p, create_agent: e.target.checked }))}
            disabled={busy}
          />{" "}
          Also create agent profile
        </label>
        {core.create_agent && (
          <div className={`${grid} mt-3`}>
            <FormLabeledSelect
              label="Vendor"
              value={core.agent_vendor}
              onChange={(v) => setCore((p) => ({ ...p, agent_vendor: v }))}
              options={["anthropic", "openai", "google", "meta", "mistral", "cohere", "internal"]}
              disabled={busy}
              allowEmpty={false}
            />
            <FormLabeledInput
              label="Model"
              value={core.agent_model}
              onChange={(v) => setCore((p) => ({ ...p, agent_model: v }))}
              disabled={busy}
            />
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={core.requires_human_loop}
                  onChange={(e) => setCore((p) => ({ ...p, requires_human_loop: e.target.checked }))}
                  disabled={busy}
                />{" "}
                Requires human loop (HITL)
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onCancel && (
          <button
            type="button"
            className="min-w-[7rem] rounded-md border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="min-w-[7rem] rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          onClick={submit}
          disabled={busy || usersLoading}
        >
          Create
        </button>
      </div>
    </>
  );

  const pageHeading = title ?? "Create new NHI";

  if (variant === "page") {
    return (
      <div className="w-full max-w-none rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">{pageHeading}</h1>
        <p className="mb-6 text-sm text-slate-600">Name is required.</p>
        {formBody}
      </div>
    );
  }

  return (
    <>
      {title ? (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      ) : null}
      {formBody}
    </>
  );
}

/** Full page wrapper with padding and back link to NHI Inventory. */
export function NhiCreatePageClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<"form" | "done">("form");
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (phase === "done") {
    return (
      <div className="w-full max-w-none rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-green-900">NHI created successfully.</p>
        {createdId ? (
          <p className="mt-2 font-mono text-sm text-green-800">{createdId}</p>
        ) : (
          <p className="mt-2 text-sm text-green-800">The server did not return a new id in the response.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {createdId ? (
            <Link
              href={`/non-human-identity/nhi-inventory/${encodeURIComponent(createdId)}`}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
            >
              View in inventory
            </Link>
          ) : null}
          <Link
            href="/non-human-identity/nhi-inventory"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            NHI Inventory
          </Link>
          <Link
            href="/non-human-identity-1/service-accounts"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Service Accounts
          </Link>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
            onClick={() => {
              setPhase("form");
              setCreatedId(null);
            }}
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <NhiCreateForm
      variant="page"
      title="Create new NHI"
      onSuccess={(id) => {
        setCreatedId(id);
        setPhase("done");
      }}
      onCancel={() => router.push("/non-human-identity/nhi-inventory")}
    />
  );
}
