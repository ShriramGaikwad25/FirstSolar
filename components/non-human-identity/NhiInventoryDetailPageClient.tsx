"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { executeQuery } from "@/lib/api";
import { extractResultRows, unwrapRowJson } from "@/lib/nhi-dashboard";

/** Scoped to the viewed row; same projection as SELECT * FROM public.kf_nhi_identity. */
const NHI_DETAIL_QUERY = `SELECT * FROM public.kf_nhi_identity WHERE nhi_id = ?::uuid`;

const IDENTITY_SECTIONS = [
  { jsonKey: "basic_attributes", title: "General" },
  { jsonKey: "security_attributes", title: "Security" },
  { jsonKey: "lifecycle_attributes", title: "Lifecycle" },
  { jsonKey: "execution_context", title: "Execution context" },
  { jsonKey: "business_context", title: "Business context" },
] as const;

function safeText(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function humanizeKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    const parts = v.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v).trim();
  return s.length ? s : "—";
}

function getIdentityPayload(customattributes: unknown): Record<string, unknown> | null {
  if (customattributes == null) return null;
  let ca: unknown = customattributes;
  if (typeof ca === "string") {
    const t = ca.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        ca = JSON.parse(t) as unknown;
      } catch {
        return null;
      }
    }
  }
  if (!ca || typeof ca !== "object" || Array.isArray(ca)) return null;
  const obj = ca as Record<string, unknown>;
  const identity = obj.identity;
  if (identity && typeof identity === "object" && !Array.isArray(identity)) {
    return identity as Record<string, unknown>;
  }
  return obj;
}

function ExpandableAttributeCard({
  title,
  data,
  defaultOpen = false,
}: {
  title: string;
  data: Record<string, unknown> | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [data]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          {!data || entries.length === 0 ? (
            <p className="text-sm text-slate-500">No attributes in this section.</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map(([key, value]) => (
                <div key={key} className="min-w-0 sm:col-span-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="mt-0.5 break-words text-sm text-slate-900">{formatValue(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

export function NhiInventoryDetailPageClient({ nhiId }: { nhiId: string }) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await executeQuery<unknown>(NHI_DETAIL_QUERY, [nhiId]);
      const rows = extractResultRows(response).map((r) => unwrapRowJson(r as Record<string, unknown>));
      const match =
        rows.find((r) => safeText(r.nhi_id).toLowerCase() === nhiId.toLowerCase()) ?? rows[0] ?? null;
      setRow(match);
    } catch (e) {
      setRow(null);
      setError(e instanceof Error ? e.message : "Failed to load NHI details");
    } finally {
      setLoading(false);
    }
  }, [nhiId]);

  useEffect(() => {
    void load();
  }, [load]);

  const identityPayload = useMemo(() => getIdentityPayload(row?.customattributes), [row]);

  const titleName = row ? safeText(row.name) : "—";

  return (
    <div className="w-full min-w-0 space-y-6 pb-8">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">{titleName}</h1>
        {row && (
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Type:</span> {safeText(row.nhi_type)}
            <span className="mx-2 text-slate-300" aria-hidden>
              ·
            </span>
            <span className="font-medium text-slate-700">State:</span> {safeText(row.state)}
            <span className="mx-2 text-slate-300" aria-hidden>
              ·
            </span>
            <span className="font-medium text-slate-700">ID:</span>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{nhiId}</code>
          </p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-slate-600" role="status">
          Loading details…
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && !row && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No identity was found for this ID.
        </div>
      )}

      {!loading && row && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Identity attributes</h2>
          {IDENTITY_SECTIONS.map(({ jsonKey, title }, i) => (
            <ExpandableAttributeCard
              key={jsonKey}
              title={title}
              data={
                identityPayload && typeof identityPayload[jsonKey] === "object" && identityPayload[jsonKey] !== null
                  ? (identityPayload[jsonKey] as Record<string, unknown>)
                  : null
              }
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
