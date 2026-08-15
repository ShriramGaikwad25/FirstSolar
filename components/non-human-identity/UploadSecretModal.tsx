"use client";

import { useState } from "react";
import { nhiV2ExecuteScalar } from "@/lib/nhi-v2-api";

const SECRET_TYPES = [
  { code: "api_key", label: "API Key" },
  { code: "bearer_token", label: "Bearer Token" },
  { code: "oauth_token", label: "OAuth Token" },
  { code: "oauth_client_secret", label: "OAuth Client Secret" },
  { code: "password", label: "Password" },
  { code: "database_password", label: "Database Password" },
  { code: "hmac_key", label: "HMAC Key" },
  { code: "ssh_private_key", label: "SSH Private Key" },
];

const VAULT_PROVIDERS = [
  "hashicorp_vault",
  "aws_secrets_manager",
  "azure_key_vault",
  "gcp_secret_manager",
  "cyberark",
  "akeyless",
  "doppler",
  "one_password",
];

type Props = {
  row: Record<string, unknown>;
  userid: string;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (error: Error) => void;
};

async function hashBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export default function UploadSecretModal({ row, userid, onClose, onDone, onError }: Props) {
  const name = String(row.name ?? "nhi");
  const existingType = String(row.primary_secret_type || "api_key");
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [f, setF] = useState({
    secret_type: existingType,
    name: row.primary_secret_id ? "" : `${name}-secret`,
    vault_provider: "hashicorp_vault",
    vault_path: `kv://${name}/secret`,
    raw_material: "",
    fingerprint: "",
    file_name: "",
    file_size: 0,
    expires_at: "",
    rotation_days: 90,
    description: "",
    import_to_vault: true,
  });
  const [busy, setBusy] = useState(false);
  const [hashing, setHashing] = useState(false);
  const upd = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function fingerprintFromRaw() {
    if (!f.raw_material) return;
    setHashing(true);
    try {
      const enc = new TextEncoder().encode(f.raw_material);
      const fp = await hashBuffer(enc.buffer);
      upd("fingerprint", fp);
      upd("raw_material", "");
    } finally {
      setHashing(false);
    }
  }

  async function fingerprintFromFile(file: File | undefined) {
    if (!file) return;
    setHashing(true);
    try {
      const fp = await hashBuffer(await file.arrayBuffer());
      upd("fingerprint", fp);
      upd("file_name", file.name);
      upd("file_size", file.size);
    } finally {
      setHashing(false);
    }
  }

  async function save() {
    if (!f.fingerprint) {
      onError(new Error('Compute fingerprint first (paste or pick a file, then click "Compute fingerprint")'));
      return;
    }
    setBusy(true);
    try {
      const nhiId = String(row.nhi_id);
      const secretName = f.name || `${name}-secret`;
      if (f.import_to_vault) {
        await nhiV2ExecuteScalar(
          `SELECT public.kf_nhi_owner_upload_secret_v2(
                    ?::uuid, ?::uuid, ?::text, ?::text,
                    ?::text, ?::text, ?::text,
                    NULLIF(?, '')::timestamptz, NULLIF(?, '')::int, ?::text,
                    ?::boolean, ?::text, NULLIF(?, '')::int) AS r`,
          [
            nhiId,
            userid,
            f.secret_type,
            secretName,
            f.vault_provider,
            f.vault_path,
            f.fingerprint,
            f.expires_at,
            f.rotation_days,
            f.description || null,
            true,
            `local-stage://${nhiId}/${f.fingerprint}`,
            f.file_size || null,
          ]
        );
        onDone(
          (row.primary_secret_id ? "Credential rotated" : "Credential registered") +
            " — queued for vault import"
        );
      } else {
        await nhiV2ExecuteScalar(
          `SELECT public.kf_nhi_owner_upload_secret(
                    ?::uuid, ?::uuid, ?::text, ?::text,
                    ?::text, ?::text, ?::text,
                    NULLIF(?, '')::timestamptz, NULLIF(?, '')::int, ?::text) AS r`,
          [
            nhiId,
            userid,
            f.secret_type,
            secretName,
            f.vault_provider,
            f.vault_path,
            f.fingerprint,
            f.expires_at,
            f.rotation_days,
            f.description || null,
          ]
        );
        onDone(row.primary_secret_id ? "Credential rotated" : "Credential registered");
      }
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {row.primary_secret_id ? "Rotate" : "Add"} credential — {name}
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          Plaintext is hashed locally and never sent to the server. Record vault path and metadata
          only.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Secret type">
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.secret_type}
              onChange={(e) => upd("secret_type", e.target.value)}
            >
              {SECRET_TYPES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display name">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.name}
              onChange={(e) => upd("name", e.target.value)}
            />
          </Field>
          <Field label="Vault provider">
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.vault_provider}
              onChange={(e) => upd("vault_provider", e.target.value)}
            >
              {VAULT_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vault path">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.vault_path}
              onChange={(e) => upd("vault_path", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-2 flex gap-2 border-b border-slate-200">
              {(["paste", "file"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    mode === m
                      ? "border-b-2 border-blue-600 text-blue-700"
                      : "text-slate-600"
                  }`}
                >
                  {m === "paste" ? "Paste text" : "Upload file"}
                </button>
              ))}
            </div>
            {mode === "paste" ? (
              <>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={f.raw_material}
                  onChange={(e) => upd("raw_material", e.target.value)}
                  placeholder="Paste secret — hashed locally then discarded"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void fingerprintFromRaw()}
                    disabled={!f.raw_material || hashing}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                  >
                    {hashing ? "Hashing…" : "Compute fingerprint"}
                  </button>
                  <input
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                    value={f.fingerprint}
                    onChange={(e) => upd("fingerprint", e.target.value)}
                    placeholder="sha256:…"
                  />
                </div>
              </>
            ) : (
              <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                {f.file_name || "Click to select a file"}
                <input
                  type="file"
                  hidden
                  onChange={(e) => void fingerprintFromFile(e.target.files?.[0])}
                />
                {f.fingerprint && (
                  <span className="mt-2 font-mono text-xs">{f.fingerprint}</span>
                )}
              </label>
            )}
          </div>
          <Field label="Rotation cadence (days)">
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.rotation_days}
              onChange={(e) => upd("rotation_days", e.target.value)}
            />
          </Field>
          <Field label="Expires at (optional)">
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.expires_at}
              onChange={(e) => upd("expires_at", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <input
                type="checkbox"
                checked={f.import_to_vault}
                onChange={(e) => upd("import_to_vault", e.target.checked)}
                className="mt-0.5"
              />
              <span>Stage for import to {f.vault_provider}</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !f.fingerprint}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {row.primary_secret_id ? "Save rotation" : "Register credential"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
