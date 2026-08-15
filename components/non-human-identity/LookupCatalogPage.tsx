"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { runNhiRows, runNhiScalar, type NhiApiMode } from "@/lib/nhi-v2-query";
import { RotateCw } from "lucide-react";

type Row = Record<string, unknown>;

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return 0;
}

async function runRows(mode: NhiApiMode, query: string, parameters: unknown[] = []): Promise<Row[]> {
  return runNhiRows(mode, query, parameters);
}

async function runScalar(mode: NhiApiMode, query: string, parameters: unknown[] = []): Promise<unknown> {
  return runNhiScalar(mode, query, parameters);
}

type CategoryRow = { category: string; n: number };
type LookupRow = {
  lookup_id: string;
  category: string;
  code: string;
  label: string;
  description: string;
  color_hex: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
};

export function LookupCatalogPage({ apiMode = "legacy" }: { apiMode?: NhiApiMode } = {}) {
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    code: "",
    label: "",
    color_hex: "",
    sort_order: 100,
  });

  const loadCategories = useCallback(async () => {
    const r = await runRows(apiMode,
      `SELECT category, count(*)::int AS n
         FROM public.kf_nhi_lookup
        GROUP BY category
        ORDER BY category`,
      []
    );
    const parsed = r.map((x) => ({
      category: asText(x.category),
      n: asNum(x.n),
    }));
    setCats(parsed);
    if (!cat && parsed.length) setCat(parsed[0].category);
  }, [cat]);

  const loadCategory = useCallback(async () => {
    if (!cat) return;
    const r = await runRows(apiMode,
      `SELECT lookup_id, category, code, label, description,
              color_hex, sort_order, is_active, is_system
         FROM public.kf_nhi_lookup
        WHERE category = ?
        ORDER BY sort_order, code`,
      [cat]
    );
    setRows(
      r.map((x) => ({
        lookup_id: asText(x.lookup_id),
        category: asText(x.category),
        code: asText(x.code),
        label: asText(x.label),
        description: asText(x.description),
        color_hex: asText(x.color_hex),
        sort_order: asNum(x.sort_order),
        is_active: Boolean(x.is_active),
        is_system: Boolean(x.is_system),
      }))
    );
  }, [cat]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadCategories();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load lookup categories");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCategories]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await loadCategory();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load category values");
      }
    })();
  }, [loadCategory]);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      await loadCategories();
      await loadCategory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    }
  }, [loadCategories, loadCategory]);

  const upsert = async () => {
    if (!cat || !form.code.trim() || !form.label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await runScalar(apiMode,
        `SELECT public.kf_nhi_lookup_upsert(?, ?, ?, NULL, ?::int, ?) AS r`,
        [cat, form.code.trim(), form.label.trim(), String(form.sort_order || 100), form.color_hex.trim() || null]
      );
      setForm({ code: "", label: "", color_hex: "", sort_order: 100 });
      await loadCategory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upsert failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = useCallback(async (row: LookupRow) => {
    setBusy(true);
    setError(null);
    try {
      if (row.is_active) {
        await runScalar(apiMode,`SELECT public.kf_nhi_lookup_deactivate(?, ?) AS r`, [row.category, row.code]);
      } else {
        await runScalar(apiMode,
          `SELECT public.kf_nhi_lookup_upsert(?, ?, ?, NULL, ?::int, ?) AS r`,
          [row.category, row.code, row.label, String(row.sort_order || 100), row.color_hex || null]
        );
      }
      await loadCategory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setBusy(false);
    }
  }, [apiMode, loadCategory]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.code, r.label, r.description, r.color_hex].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Code",
        field: "code",
        cellRenderer: (params: ICellRendererParams<LookupRow>) => params.data?.code || "—",
      },
      {
        headerName: "Label",
        field: "label",
        cellRenderer: (params: ICellRendererParams<LookupRow>) => params.data?.label || "—",
      },
      {
        headerName: "Color",
        field: "color_hex",
        cellRenderer: (params: ICellRendererParams<LookupRow>) => {
          const colorHex = params.data?.color_hex;
          if (!colorHex) return "—";
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded border border-slate-300"
                style={{ backgroundColor: colorHex }}
              />
              {colorHex}
            </span>
          );
        },
      },
      {
        headerName: "Order",
        field: "sort_order",
      },
      {
        headerName: "System",
        cellRenderer: (params: ICellRendererParams<LookupRow>) => (params.data?.is_system ? "✓" : ""),
      },
      {
        headerName: "Active",
        sortable: false,
        filter: false,
        flex: 0,
        width: 110,
        cellRenderer: (params: ICellRendererParams<LookupRow>) => {
          const r = params.data;
          if (!r) return null;
          return (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
              onClick={() => void toggle(r)}
              disabled={busy}
            >
              {r.is_active ? "✓ active" : "— inactive"}
            </button>
          );
        },
      },
    ],
    [busy, toggle]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: false,
      flex: 1,
      minWidth: 100,
      resizable: true, wrapHeaderText: true, autoHeaderHeight: true,
    }),
    []
  );

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading lookup catalog…</div>;

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Lookup Catalog</h1>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-50"
          onClick={() => void refreshAll()}
          title="Refresh"
          aria-label="Refresh"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="flex items-start gap-4">
        <aside className="sticky top-[72px] h-[calc(100vh-96px)] w-80 shrink-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Categories ({cats.length})
          </div>
          <ul className="h-[calc(100%-28px)] space-y-2 overflow-auto pr-1">
            {cats.map((c) => (
              <li key={c.category}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
                    cat === c.category
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  onClick={() => setCat(c.category)}
                >
                  <span className="truncate">{c.category}</span>
                  <span className="text-xs text-slate-500">{c.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Values · {cat || "—"}
          </h2>

          <div className="mb-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <input
              className="min-w-[200px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            />
            <input
              className="min-w-[220px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="label"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            />
            <input
              className="w-[140px] shrink-0 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="#color"
              value={form.color_hex}
              onChange={(e) => setForm((p) => ({ ...p, color_hex: e.target.value }))}
            />
            <input
              className="w-[100px] shrink-0 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
            />
            <button
              type="button"
              className="shrink-0 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={upsert}
              disabled={busy}
            >
              Add / Update
            </button>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${rows.length} rows...`}
              className="w-56 rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          {filteredRows.length === 0 && (
            <div className="px-2 py-3 text-xs text-slate-500">No lookup values.</div>
          )}

          <div
            className="ag-theme-alpine nhi-compact-grid"
            style={{ ["--ag-font-size" ]: "12px", ["--ag-header-font-size" ]: "12px" } as any}
          >
            <AgGridReact
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => {
                const data = params.data as LookupRow;
                return data.lookup_id || `${data.category}-${data.code}`;
              }}
              pagination={true}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              domLayout="autoHeight"
              rowHeight={36}
              headerHeight={32}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

