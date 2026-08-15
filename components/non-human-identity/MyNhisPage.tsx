"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RotateCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  CRITICALITY_OPTIONS,
  TYPE_ICON,
  USR_PICKER_QUERY,
  asNum,
  asText,
  isUuid,
  loadMyNhisRows,
  nhiV2UsernameCandidatesFromIspm,
  resolveMyNhisActorUserId,
  runRows,
  runScalar,
  timeago,
  type MyNhiRow,
  type UsrPickerRow,
} from "@/lib/nhi-my-nhis";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";
import UploadSecretModal from "@/components/non-human-identity/UploadSecretModal";
import UploadCertificateModal from "@/components/non-human-identity/UploadCertificateModal";

type Banner = { msg: string; kind: "ok" | "err" };

type EditState = {
  description: string;
  business_process: string;
  criticality: string;
  data_classification: string;
  ownerid: string;
  secondary_ownerid: string;
};

function riskChipClass(level: string): string {
  const k = level.toLowerCase();
  if (k.includes("critical")) return "bg-red-100 text-red-800";
  if (k.includes("high")) return "bg-orange-100 text-orange-800";
  if (k.includes("medium")) return "bg-amber-100 text-amber-800";
  if (k.includes("low")) return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

function Pill({ tone, label }: { tone: "ok" | "warn" | "err"; label: string }) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "err"
        ? "bg-red-50 text-red-800"
        : "bg-amber-50 text-amber-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

function OwnerPicker({
  users,
  value,
  currentUserid,
  onChange,
  allowEmpty = false,
}: {
  users: UsrPickerRow[];
  value: string;
  currentUserid: string;
  onChange: (v: string | null) => void;
  allowEmpty?: boolean;
}) {
  const sorted = [...users].sort((a, b) => {
    if (a.userid === currentUserid) return -1;
    if (b.userid === currentUserid) return 1;
    return (a.fullname || "").localeCompare(b.fullname || "");
  });

  return (
    <select
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {allowEmpty && <option value="">— none —</option>}
      {!allowEmpty && !value && <option value="">— pick a user —</option>}
      {sorted.map((u) => (
        <option key={u.userid} value={u.userid}>
          {u.fullname}
          {u.userid === currentUserid ? " (you)" : ""}
        </option>
      ))}
    </select>
  );
}

function FormRow({
  label,
  wide,
  help,
  children,
}: {
  label: string;
  wide?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      {children}
      {help && <span className="text-[11px] leading-snug text-slate-500">{help}</span>}
    </label>
  );
}

function NhiCard({
  row,
  currentUserid,
  allUsers,
  onDecommission,
  onMarkUsed,
  onSave,
  onUploadSecret,
  onUploadCert,
}: {
  row: MyNhiRow;
  currentUserid: string;
  allUsers: UsrPickerRow[];
  onDecommission: () => void;
  onMarkUsed: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onUploadSecret: () => void;
  onUploadCert: () => void;
}) {
  const nhiType = asText(row.nhi_type);
  const icon = TYPE_ICON[nhiType] || "·";
  const isCert = nhiType === "certificate";
  const hasSecret = ["api_key", "token", "certificate", "ssh_key", "service_account"].includes(
    nhiType
  );
  const overdue =
    row.next_rotation_at && new Date(asText(row.next_rotation_at)) < new Date();
  const expiring =
    row.expires_at &&
    new Date(asText(row.expires_at)) < new Date(Date.now() + 30 * 86400000);
  const reviewDue =
    row.next_review_at && new Date(asText(row.next_review_at)) < new Date();

  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];

  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<EditState | null>(null);

  const startEdit = () => {
    setEdits({
      description: asText(row.description),
      business_process: asText(row.business_process),
      criticality: asText(row.criticality),
      data_classification: tags.join(", "),
      ownerid: asText(row.ownerid),
      secondary_ownerid: asText(row.secondary_ownerid),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEdits(null);
  };

  const saveEdit = async () => {
    if (!edits) return;
    const payload: Record<string, unknown> = {};
    if (edits.description !== asText(row.description)) payload.description = edits.description || null;
    if (edits.business_process !== asText(row.business_process)) {
      payload.business_process = edits.business_process || null;
    }
    if (edits.criticality !== asText(row.criticality)) payload.criticality = edits.criticality || null;
    if (edits.ownerid !== asText(row.ownerid)) payload.ownerid = edits.ownerid || null;
    if (edits.secondary_ownerid !== asText(row.secondary_ownerid)) {
      payload.secondary_ownerid = edits.secondary_ownerid || null;
    }
    const newTags = edits.data_classification
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(newTags) !== JSON.stringify(tags)) {
      payload.data_classification = newTags;
    }

    const losingAccess =
      (payload.ownerid !== undefined &&
        asText(row.ownerid) === currentUserid &&
        payload.ownerid !== currentUserid) ||
      (payload.secondary_ownerid !== undefined &&
        asText(row.secondary_ownerid) === currentUserid &&
        payload.secondary_ownerid !== currentUserid);

    if (losingAccess) {
      const proceed = window.confirm(
        "You are removing yourself from an owner role on this NHI.\n\n" +
          'After saving, this NHI will no longer appear on your "My NHIs" list ' +
          "unless you also hold a role via owner-assignment.\n\nProceed?"
      );
      if (!proceed) return;
    }

    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }

    await onSave(payload);
    cancelEdit();
  };

  const nhiId = asText(row.nhi_id);
  const displayName = asText(row.displayname || row.name) || "Unnamed NHI";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="text-[28px] leading-none">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/non-human-identity-2/nhis/${encodeURIComponent(nhiId)}`}
              className="text-base font-semibold text-slate-900 hover:text-blue-700"
            >
              {displayName}
            </Link>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {nhiType || "—"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskChipClass(asText(row.risk_level || "medium"))}`}
            >
              risk · {asText(row.risk_level) || "—"}
            </span>
            {asText(row.criticality) && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                criticality · {asText(row.criticality).replace(/^tier\d+_/, "")}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {asText(row.state) || "—"}
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              you are · {asText(row.role) || "—"}
            </span>
            {row.is_privileged && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                privileged
              </span>
            )}
          </div>

          {asText(row.description) && (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-slate-700">
              {asText(row.description)}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Primary:</span>{" "}
            {asText(row.primary_owner_displayname || row.primary_owner_username) || "—"}
            {(asText(row.secondary_owner_displayname) || asText(row.secondary_owner_username)) && (
              <>
                {" "}
                · <span className="font-semibold text-slate-600">Secondary:</span>{" "}
                {asText(row.secondary_owner_displayname || row.secondary_owner_username)}
              </>
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {asText(row.instancename) && <>app · {asText(row.instancename)}</>}
            {asText(row.business_process) && <> · process · {asText(row.business_process)}</>}
            {asText(row.cost_center) && <> · cost · {asText(row.cost_center)}</>}
            {row.last_used_at && <> · last used {timeago(row.last_used_at)}</>}
          </p>

          {tags.length > 0 && !editing && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                >
                  {t}
                </span>
              ))}
              {tags.length > 6 && (
                <span className="text-[10px] text-slate-400">+{tags.length - 6} more</span>
              )}
            </div>
          )}

          {editing && edits && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Quick edit
                </p>
                <p className="text-[11px] text-slate-500">
                  Owner-safe fields only. Anything else needs an admin or a change request.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow
                  label="Description / purpose"
                  wide
                  help="What is this NHI used for and who relies on it?"
                >
                  <textarea
                    className="min-h-[64px] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    rows={3}
                    placeholder="e.g. AI agent that drafts POs in SAP for procurement officers; HITL on every write."
                    value={edits.description}
                    onChange={(e) => setEdits({ ...edits, description: e.target.value })}
                  />
                </FormRow>

                <FormRow label="Business process">
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={edits.business_process}
                    placeholder="e.g. Procure-to-Pay"
                    onChange={(e) => setEdits({ ...edits, business_process: e.target.value })}
                  />
                </FormRow>

                <FormRow label="Criticality">
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={edits.criticality}
                    onChange={(e) => setEdits({ ...edits, criticality: e.target.value })}
                  >
                    <option value="">— pick a tier —</option>
                    {CRITICALITY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </FormRow>

                <FormRow
                  label="Data classification"
                  wide
                  help="Comma-separated tags. Common values: PII, PHI, PCI, SOX, FIN, internal, confidential."
                >
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={edits.data_classification}
                    placeholder="PII, FIN, internal"
                    onChange={(e) =>
                      setEdits({ ...edits, data_classification: e.target.value })
                    }
                  />
                </FormRow>

                <FormRow
                  label="Primary owner"
                  help={
                    edits.ownerid === currentUserid
                      ? "You are the primary owner."
                      : "Reassigning will move responsibility to another user."
                  }
                >
                  <OwnerPicker
                    users={allUsers}
                    value={edits.ownerid}
                    currentUserid={currentUserid}
                    onChange={(v) => setEdits({ ...edits, ownerid: v || "" })}
                  />
                </FormRow>

                <FormRow
                  label="Backup / secondary owner"
                  help="Optional. Steps in if the primary is unavailable."
                >
                  <OwnerPicker
                    users={allUsers}
                    value={edits.secondary_ownerid}
                    currentUserid={currentUserid}
                    allowEmpty
                    onChange={(v) => setEdits({ ...edits, secondary_ownerid: v || "" })}
                  />
                </FormRow>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {asNum(row.open_findings) > 0 && (
              <Pill
                tone="err"
                label={`${asNum(row.open_findings)} finding${asNum(row.open_findings) === 1 ? "" : "s"}`}
              />
            )}
            {asNum(row.open_suggestions) > 0 && (
              <Pill
                tone="warn"
                label={`${asNum(row.open_suggestions)} suggestion${asNum(row.open_suggestions) === 1 ? "" : "s"}`}
              />
            )}
            {overdue && <Pill tone="err" label="rotation overdue" />}
            {expiring && (
              <Pill tone="warn" label={`expires ${timeago(row.expires_at)}`} />
            )}
            {reviewDue && <Pill tone="warn" label="review due" />}
            {!asNum(row.open_findings) &&
              !asNum(row.open_suggestions) &&
              !overdue &&
              !expiring &&
              !reviewDue && <Pill tone="ok" label="healthy" />}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/non-human-identity-2/nhis/${encodeURIComponent(nhiId)}`}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View
            </Link>
            {!editing && (
              <button
                type="button"
                onClick={startEdit}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Quick edit
              </button>
            )}
            <button
              type="button"
              onClick={onMarkUsed}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Mark used
            </button>
            {hasSecret && !isCert && (
              <button
                type="button"
                onClick={onUploadSecret}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {row.primary_secret_id ? "Rotate / upload new secret" : "Add credential"}
              </button>
            )}
            {isCert && (
              <button
                type="button"
                onClick={onUploadCert}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {row.primary_secret_id ? "Renew certificate" : "Upload certificate"}
              </button>
            )}
            <button
              type="button"
              onClick={onDecommission}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Request decommission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyNhisPage() {
  const { user, isAuthenticated } = useAuth();

  const usernameCandidates = useMemo(
    () => nhiV2UsernameCandidatesFromIspm(user?.email),
    [user?.email]
  );

  const [userid, setUserid] = useState<string | null>(() => {
    const hit = usernameCandidates.find(isUuid);
    return hit ?? null;
  });
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [rows, setRows] = useState<MyNhiRow[]>([]);
  const [allUsers, setAllUsers] = useState<UsrPickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [uploadSecretFor, setUploadSecretFor] = useState<MyNhiRow | null>(null);
  const [uploadCertFor, setUploadCertFor] = useState<MyNhiRow | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const u = await runRows(USR_PICKER_QUERY);
        if (!alive) return;
        setAllUsers(
          u.map((r) => ({
            userid: asText(r.userid),
            fullname: asText(r.fullname),
            username: asText(r.username),
          }))
        );
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (userid) return;
    if (!isAuthenticated || usernameCandidates.length === 0) {
      setResolveErr("Not signed in");
      setLoading(false);
      return;
    }

    let alive = true;
    void (async () => {
      try {
        const resolved = await resolveMyNhisActorUserId(usernameCandidates);
        if (!alive) return;
        if (resolved) {
          setUserid(resolved);
        } else {
          setResolveErr(
            `No usr row matched "${usernameCandidates[0]}". Ask an admin to add you to usr or assign you as an NHI owner.`
          );
          setLoading(false);
        }
      } catch (e) {
        if (!alive) return;
        setResolveErr(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.email, userid]);

  const load = useCallback(async () => {
    if (!userid) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await loadMyNhisRows(userid);
      setRows(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userid]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg: string, kind: Banner["kind"] = "ok") => {
    setBanner({ msg, kind });
    window.setTimeout(() => setBanner(null), 4000);
  };

  const handleDecommission = async (nhiId: string, name: string) => {
    if (!userid) return;
    const reason = window.prompt(`Why decommission "${name}"? (required)`);
    if (!reason?.trim()) return;
    try {
      await runScalar(
        `SELECT public.kf_nhi_owner_request_decommission(?::uuid, ?::uuid, ?::text) AS r`,
        [nhiId, userid, reason.trim()]
      );
      flash("Decommission request submitted — pending approval");
      void load();
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e), "err");
    }
  };

  const handleMarkUsed = async (nhiId: string) => {
    try {
      await runScalar(
        `SELECT public.kf_nhi_mark_nhi_used(?::uuid, NULL::uuid, ?::text) AS r`,
        [nhiId, user?.email || "ui"]
      );
      flash("Marked as used");
      void load();
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e), "err");
    }
  };

  const handleSaveEdits = async (nhiId: string, payload: Record<string, unknown>) => {
    if (!userid) return;
    try {
      await runScalar(
        `SELECT public.kf_nhi_owner_save_attributes(?::uuid, ?::uuid, ?::jsonb) AS r`,
        [nhiId, userid, JSON.stringify(payload)]
      );
      flash("Saved");
      void load();
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e), "err");
    }
  };

  if (resolveErr) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Can&apos;t find you in <code className="text-sm">usr</code>
        </h2>
        <p className="mt-2 text-sm text-slate-600">{resolveErr}</p>
        <p className="mt-2 text-xs text-slate-500">
          Logged-in as: <span className="font-medium">{user?.email || "anonymous"}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setResolveErr(null);
            setLoading(true);
            setUserid(null);
          }}
          className="mt-3 text-sm font-medium text-amber-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!userid && loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">{err}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-sm font-medium text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      asText(r.name).toLowerCase().includes(q) ||
      asText(r.displayname).toLowerCase().includes(q) ||
      asText(r.nhi_type).toLowerCase().includes(q)
    );
  });

  return (
    <div className={`${NHI2_PAGE_SHELL_CLASS} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My NHIs</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Non-human identities you own as primary, secondary, or via owner-assignment. From here
            you can rotate credentials, renew certificates, edit business context, and submit change
            requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <Link
            href="/non-human-identity/create-nhi"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Register NHI
          </Link>
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {banner.msg}
        </div>
      )}

      <input
        className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        placeholder="Filter by name, type…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            You don&apos;t own any NHIs yet. If this is unexpected, ask an admin to assign you as
            owner from NHI Inventory.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((r) => {
          const nhiId = asText(r.nhi_id);
          const name = asText(r.displayname || r.name);
          return (
            <NhiCard
              key={nhiId}
              row={r}
              currentUserid={userid!}
              allUsers={allUsers}
              onDecommission={() => void handleDecommission(nhiId, name)}
              onMarkUsed={() => void handleMarkUsed(nhiId)}
              onSave={(payload) => handleSaveEdits(nhiId, payload)}
              onUploadSecret={() => setUploadSecretFor(r)}
              onUploadCert={() => setUploadCertFor(r)}
            />
          );
        })}
      </div>

      {uploadSecretFor && userid && (
        <UploadSecretModal
          row={uploadSecretFor}
          userid={userid}
          onClose={() => setUploadSecretFor(null)}
          onDone={(m) => {
            setUploadSecretFor(null);
            flash(m);
            void load();
          }}
          onError={(e) => flash(e.message, "err")}
        />
      )}
      {uploadCertFor && userid && (
        <UploadCertificateModal
          row={uploadCertFor}
          userid={userid}
          onClose={() => setUploadCertFor(null)}
          onDone={(m) => {
            setUploadCertFor(null);
            flash(m);
            void load();
          }}
          onError={(e) => flash(e.message, "err")}
        />
      )}
    </div>
  );
}
