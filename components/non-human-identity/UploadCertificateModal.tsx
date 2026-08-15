"use client";

import { useState } from "react";
import { nhiV2ExecuteScalar } from "@/lib/nhi-v2-api";

const KEY_ALGOS = ["rsa", "ecdsa", "ed25519", "ed448", "rsa_pss"];
const VAULT_PROVIDERS = [
  "hashicorp_vault",
  "aws_secrets_manager",
  "azure_key_vault",
  "gcp_secret_manager",
  "cyberark",
  "akeyless",
];

type Props = {
  row: Record<string, unknown>;
  userid: string;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (error: Error) => void;
};

async function hashPemBody(pemText: string): Promise<string> {
  const body = pemText
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const buf = await crypto.subtle.digest("SHA-256", der);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")
    .toUpperCase();
  return `sha256:${hex}`;
}

async function hashRawBytes(arrayBuffer: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")
    .toUpperCase();
  return `sha256:${hex}`;
}

export default function UploadCertificateModal({ row, userid, onClose, onDone, onError }: Props) {
  const name = String(row.name ?? "nhi");
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [f, setF] = useState({
    name: row.primary_secret_id ? "" : `${name}-cert`,
    vault_provider: "hashicorp_vault",
    vault_path: `pki://${name}/cert`,
    pem: "",
    fingerprint: "",
    file_name: "",
    file_size: 0,
    cn: "",
    issuer: "",
    key_algorithm: "rsa",
    key_length_bits: 2048,
    not_after: "",
    san: "",
    code_signing: false,
    description: "",
    import_to_vault: true,
  });
  const [busy, setBusy] = useState(false);
  const [hashing, setHashing] = useState(false);
  const upd = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function fingerprintFromFile(file: File | undefined) {
    if (!file) return;
    setHashing(true);
    try {
      const text = await file.text();
      const fp =
        text.includes("-----BEGIN") && text.includes("-----END")
          ? await hashPemBody(text)
          : await hashRawBytes(await file.arrayBuffer());
      upd("fingerprint", fp);
      upd("file_name", file.name);
      upd("file_size", file.size);
    } catch {
      onError(new Error("Could not parse file. Use a valid PEM or DER certificate."));
    } finally {
      setHashing(false);
    }
  }

  async function hashPem() {
    if (!f.pem) return;
    setHashing(true);
    try {
      const fp = await hashPemBody(f.pem);
      upd("fingerprint", fp);
      upd("pem", "");
    } catch {
      onError(new Error("Could not parse PEM. Paste the BEGIN…END block including headers."));
    } finally {
      setHashing(false);
    }
  }

  async function save() {
    if (!f.fingerprint || !f.cn || !f.issuer || !f.not_after) {
      onError(new Error("CN, issuer, fingerprint, and not_after are required."));
      return;
    }
    setBusy(true);
    try {
      const nhiId = String(row.nhi_id);
      const certName = f.name || `${name}-cert`;
      const sanArr = (f.san || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (f.import_to_vault) {
        await nhiV2ExecuteScalar(
          `SELECT public.kf_nhi_owner_upload_certificate_v2(
                    ?::uuid, ?::uuid, ?::text,
                    ?::text, ?::text, ?::text,
                    ?::text, ?::text, ?::text, ?::int,
                    ?::timestamptz, ?::text[], ?::boolean, ?::text,
                    ?::boolean, ?::text, NULLIF(?, '')::int) AS r`,
          [
            nhiId,
            userid,
            certName,
            f.vault_provider,
            f.vault_path,
            f.fingerprint,
            f.cn,
            f.issuer,
            f.key_algorithm,
            f.key_length_bits,
            f.not_after,
            sanArr,
            f.code_signing,
            f.description || null,
            true,
            `local-stage://${nhiId}/${f.fingerprint}`,
            f.file_size || null,
          ]
        );
        onDone(
          (row.primary_secret_id ? "Certificate renewed" : "Certificate registered") +
            " — queued for vault import"
        );
      } else {
        await nhiV2ExecuteScalar(
          `SELECT public.kf_nhi_owner_upload_certificate(
                    ?::uuid, ?::uuid, ?::text,
                    ?::text, ?::text, ?::text,
                    ?::text, ?::text, ?::text, ?::int,
                    ?::timestamptz, ?::text[], ?::boolean, ?::text) AS r`,
          [
            nhiId,
            userid,
            certName,
            f.vault_provider,
            f.vault_path,
            f.fingerprint,
            f.cn,
            f.issuer,
            f.key_algorithm,
            f.key_length_bits,
            f.not_after,
            sanArr,
            f.code_signing,
            f.description || null,
          ]
        );
        onDone(row.primary_secret_id ? "Certificate renewed" : "Certificate registered");
      }
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {row.primary_secret_id ? "Renew" : "Upload"} certificate — {name}
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          We store only metadata (CN, issuer, key parameters, not-after, vault reference). Push
          the actual cert + private key to your vault first; paste the resulting path below.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
            <Field label="Vault path">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={f.vault_path}
                onChange={(e) => upd("vault_path", e.target.value)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Certificate material
            </span>
            <div className="mt-1 mb-2 flex gap-2 border-b border-slate-200">
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
                  {m === "paste" ? "Paste PEM" : "Upload file"}
                </button>
              ))}
            </div>
            {mode === "paste" ? (
              <>
                <textarea
                  className="min-h-[96px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                  value={f.pem}
                  onChange={(e) => upd("pem", e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void hashPem()}
                    disabled={!f.pem || hashing}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                  >
                    {hashing ? "Hashing…" : "Compute fingerprint"}
                  </button>
                  <input
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                    value={f.fingerprint}
                    onChange={(e) => upd("fingerprint", e.target.value)}
                    placeholder="sha256:AA:BB:…"
                  />
                </div>
              </>
            ) : (
              <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                {f.file_name
                  ? `${f.file_name} · ${Math.round(f.file_size / 1024)} KB`
                  : "Click to select a certificate file"}
                <input
                  type="file"
                  hidden
                  accept=".pem,.crt,.cer,.der,.p12,.pfx"
                  onChange={(e) => void fingerprintFromFile(e.target.files?.[0])}
                />
                {f.fingerprint && (
                  <span className="mt-2 font-mono text-xs">{f.fingerprint}</span>
                )}
              </label>
            )}
          </div>

          <Field label="CN (Common name) *">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.cn}
              onChange={(e) => upd("cn", e.target.value)}
              placeholder="*.acme.com"
            />
          </Field>
          <Field label="Issuer / CA *">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.issuer}
              onChange={(e) => upd("issuer", e.target.value)}
            />
          </Field>
          <Field label="Key algorithm">
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.key_algorithm}
              onChange={(e) => upd("key_algorithm", e.target.value)}
            >
              {KEY_ALGOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Key length (bits)">
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.key_length_bits}
              onChange={(e) => upd("key_length_bits", Number(e.target.value))}
            />
          </Field>
          <Field label="Not after *">
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={f.not_after}
              onChange={(e) => upd("not_after", e.target.value)}
            />
          </Field>
          <Field label="Code-signing">
            <input
              type="checkbox"
              checked={f.code_signing}
              onChange={(e) => upd("code_signing", e.target.checked)}
              className="mt-2"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="SAN list (comma-separated)">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={f.san}
                onChange={(e) => upd("san", e.target.value)}
                placeholder="api.acme.com, internal.acme.local"
              />
            </Field>
          </div>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={f.import_to_vault}
            onChange={(e) => upd("import_to_vault", e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Stage for import to <strong>{f.vault_provider}</strong> — adds a pending vault import
            row for your sync worker.
          </span>
        </label>

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
            disabled={busy}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {row.primary_secret_id ? "Save renewal" : "Register certificate"}
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
