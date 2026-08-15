"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { runNhiRows, type NhiApiMode } from "@/lib/nhi-v2-query";
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#14b8a6", "#f472b6"];

type Row = Record<string, unknown>;

function text(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return 0;
}

function outcomeColor(name: string, i: number): string {
  const v = name.toLowerCase();
  if (v === "success") return "#10b981";
  if (v === "denied") return "#ef4444";
  if (v === "error") return "#ef4444";
  return PALETTE[i % PALETTE.length];
}

export function RfcCallsPage({ apiMode = "legacy" }: { apiMode?: NhiApiMode } = {}) {
  const [agents, setAgents] = useState<Row[]>([]);
  const [sel, setSel] = useState("");
  const [calls, setCalls] = useState<Row[]>([]);
  const [commMap, setCommMap] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traceSearch, setTraceSearch] = useState("");

  const loadCalls = useCallback(async (agentNhiId: string) => {
    if (!agentNhiId || agentNhiId === "undefined") {
      setCalls([]);
      setCommMap({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await runNhiRows(
        apiMode,
        `SELECT l.action_log_id as action_id, l.occurred_at, l.intent, l.outcome,
                l.target_object_key          AS rfc_name,
                (l.request_params->>'comm_user_nhi_id')::uuid AS comm_user_nhi_id,
                l.request_params->>'comm_user_name'           AS comm_user_name,
                l.request_params,
                l.response_summary,
                l.amount, l.currency, l.latency_ms, l.correlation_id,
                null requires_approval, null approved_by
           FROM public.kf_nhi_agent_action_log l
          WHERE l.tenant_id = ?::uuid
            AND l.nhi_id    = ?::uuid
            AND l.target_object_type = 'rfc_call'
       ORDER BY l.occurred_at DESC
          LIMIT 500`,
        [TENANT_ID, agentNhiId]
      );
      setCalls(rows);

      const ids = [...new Set(rows.map((r) => text(r.comm_user_nhi_id)).filter(Boolean))];
      if (ids.length === 0) {
        setCommMap({});
        return;
      }
      const placeholders = ids.map(() => "?::uuid").join(", ");
      const cRows = await runNhiRows(
        apiMode,
        `SELECT i.nhi_id, i.name, i.displayname, i.state, i.risk_level,
                i.criticality, i.customattributes, i.tags, i.description
           FROM public.kf_nhi_identity i
          WHERE i.tenant_id = ?::uuid
            AND i.nhi_id IN (${placeholders})`,
        [TENANT_ID, ...ids]
      );
      const map: Record<string, Row> = {};
      for (const c of cRows) map[text(c.nhi_id)] = c;
      setCommMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load RFC calls");
    } finally {
      setLoading(false);
    }
  }, [apiMode]);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const rows = await runNhiRows(
          apiMode,
          `SELECT i.nhi_id, i.name, i.displayname, i.nhi_type,
                  COALESCE(ap.model_name, '') AS model_name,
                  COALESCE(ap.vendor,     '') AS vendor
             FROM public.kf_nhi_identity i
        LEFT JOIN public.kf_nhi_agent_profile ap
                  ON ap.tenant_id = i.tenant_id AND ap.nhi_id = i.nhi_id
            WHERE i.tenant_id = ?::uuid
              AND i.nhi_type IN ('agent','service_account')
         ORDER BY CASE WHEN ap.vendor <> '' THEN 0 ELSE 1 END,
                  i.displayname, i.name`,
          [TENANT_ID]
        );
        setAgents(rows);
        const auto = rows.find(
          (r) =>
            /p2p.*auto/i.test(text(r.name)) ||
            /autonomous/i.test(text(r.displayname))
        );
        setSel(text((auto || rows[0] || {}).nhi_id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load agents");
      }
    })();
  }, []);

  useEffect(() => {
    void loadCalls(sel);
  }, [sel, loadCalls]);

  const byRfc = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calls) {
      const k = text(c.rfc_name) || "(n/a)";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [calls]);

  const byCommuser = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calls) {
      const id = text(c.comm_user_nhi_id) || "(unknown)";
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([id, value]) => ({
        id,
        name: text(commMap[id]?.displayname) || text(commMap[id]?.name) || id.slice(0, 8),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [calls, commMap]);

  const byOutcome = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calls) {
      const k = text(c.outcome) || "unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [calls]);

  const total = calls.length;
  const success = calls.filter((c) => text(c.outcome).toLowerCase() === "success").length;
  const denied = calls.filter((c) => ["denied", "error"].includes(text(c.outcome).toLowerCase())).length;
  const successPct = total > 0 ? ((success / total) * 100).toFixed(1) : "0.0";
  const avgLat = total > 0 ? Math.round(calls.reduce((s, c) => s + num(c.latency_ms), 0) / total) : 0;
  const totalAmt = calls.reduce((s, c) => s + num(c.amount), 0);
  const selAgent = agents.find((a) => text(a.nhi_id) === sel);
  const commUserIds = Object.keys(commMap);

  const filteredTraceCalls = useMemo(() => {
    const q = traceSearch.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter((c) => {
      const commId = text(c.comm_user_nhi_id);
      const commName = text(c.comm_user_name) || text(commMap[commId]?.name) || text(commMap[commId]?.displayname);
      const blob = [
        text(c.occurred_at),
        text(c.rfc_name),
        text(c.intent),
        text(c.outcome),
        commName,
        text(c.currency),
        text(c.correlation_id),
        text(c.response_summary),
        text(c.amount),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [calls, traceSearch, commMap]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "When",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <>{text(c.occurred_at) ? new Date(text(c.occurred_at)).toLocaleString() : "—"}</>;
        },
      },
      {
        headerName: "RFC / BAPI",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <span className="font-mono text-[11px] text-slate-700">{text(c.rfc_name) || "—"}</span>;
        },
      },
      {
        headerName: "Intent",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <>{text(c.intent) || "—"}</>;
        },
      },
      {
        headerName: "Comm user",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          const commId = text(c.comm_user_nhi_id);
          return <>{text(c.comm_user_name) || text(commMap[commId]?.name) || "—"}</>;
        },
      },
      {
        headerName: "Outcome",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <OutcomeBadge value={text(c.outcome)} />;
        },
      },
      {
        headerName: "Amount",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <>{c.amount != null ? `${num(c.amount).toLocaleString()} ${text(c.currency)}`.trim() : "—"}</>;
        },
      },
      {
        headerName: "Latency",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <>{c.latency_ms != null ? `${num(c.latency_ms)} ms` : "—"}</>;
        },
      },
      {
        headerName: "HITL",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          return <>{asHitl(c)}</>;
        },
      },
      {
        headerName: "Correlation",
        cellRenderer: (params: ICellRendererParams<Row>) => {
          const c = params.data as Row;
          const corr = text(c.correlation_id);
          return <span className="font-mono text-[11px] text-slate-700">{corr ? `${corr.slice(0, 8)}…` : "—"}</span>;
        },
      },
    ],
    [commMap]
  );

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: false,
      flex: 1,
      minWidth: 100, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, }), []);

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Agent → RFC Calls</h1>
        <div className="flex items-center gap-2">
          <select
            className="min-w-[280px] rounded border border-slate-300 px-3 py-1.5 text-sm"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            {agents.length === 0 && <option value="">(no agents)</option>}
            {agents.map((a) => (
              <option key={text(a.nhi_id)} value={text(a.nhi_id)}>
                {text(a.displayname) || text(a.name)}
                {text(a.vendor) ? ` · ${text(a.vendor)}` : ""}
                {text(a.model_name) ? ` / ${text(a.model_name)}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadCalls(sel)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ↻
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && <div className="text-sm text-slate-500">Loading RFC trace…</div>}

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="RFC calls" value={String(total)} />
        <Kpi label="Success" value={String(success)} tone="ok" />
        <Kpi label="Success rate" value={`${successPct}%`} tone={Number(successPct) >= 95 ? "ok" : "warn"} />
        <Kpi label="Denied/Error" value={String(denied)} tone={denied > 0 ? "warn" : "ok"} />
        <Kpi label="Avg latency" value={`${avgLat} ms`} />
        <Kpi label="$ total" value={totalAmt > 0 ? `$${totalAmt.toFixed(2)}` : "—"} />
      </section>

      {selAgent && commUserIds.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Request flow</h2>
          <div className="space-y-2 text-sm">
            {commUserIds.map((cid) => {
              const comm = commMap[cid];
              const count = calls.filter((c) => text(c.comm_user_nhi_id) === cid).length;
              return (
                <div key={cid} className="flex flex-wrap items-center gap-2">
                  <Badge>🤖 {text(selAgent.displayname) || text(selAgent.name)}</Badge>
                  <span>→</span>
                  <Badge>APIM Gateway</Badge>
                  <span>→</span>
                  <Badge>👤 {text(comm?.displayname) || text(comm?.name) || cid.slice(0, 8)}</Badge>
                  <span>→</span>
                  <Badge>
                    SAP S/4HANA{" "}
                    {typeof comm?.customattributes === "object" &&
                    comm?.customattributes &&
                    "sap_module" in (comm.customattributes as Record<string, unknown>)
                      ? `· ${text((comm.customattributes as Record<string, unknown>).sap_module)}`
                      : ""}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    ({count} call{count === 1 ? "" : "s"})
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Top RFCs (call count)">
          <Bar
            data={{
              labels: byRfc.map((x) => x.name),
              datasets: [{ label: "Calls", data: byRfc.map((x) => x.value), backgroundColor: "#6366f1", borderRadius: 4 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { ticks: { maxRotation: 30, minRotation: 30, font: { size: 10 } }, grid: { display: false } },
              },
            }}
          />
        </ChartCard>
        <ChartCard title="Calls by communication user">
          <Doughnut
            data={{
              labels: byCommuser.map((x) => x.name),
              datasets: [{ data: byCommuser.map((x) => x.value), backgroundColor: byCommuser.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 0 }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, cutout: "55%", plugins: { legend: { position: "bottom" } } }}
          />
        </ChartCard>
        <ChartCard title="Outcome breakdown">
          <Doughnut
            data={{
              labels: byOutcome.map((x) => x.name),
              datasets: [{ data: byOutcome.map((x) => x.value), backgroundColor: byOutcome.map((x, i) => outcomeColor(x.name, i)), borderWidth: 0 }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, cutout: "55%", plugins: { legend: { position: "bottom" } } }}
          />
        </ChartCard>
      </section>

      {commUserIds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Communication user permissions</h2>
          {commUserIds.map((cid) => (
            <CommUserCard
              key={cid}
              comm={commMap[cid]}
              callCount={calls.filter((c) => text(c.comm_user_nhi_id) === cid).length}
            />
          ))}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">RFC call trace</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={traceSearch}
              onChange={(e) => setTraceSearch(e.target.value)}
              placeholder={`Search ${calls.length} rows...`}
              className="w-60 rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div
            className="ag-theme-alpine nhi-compact-grid"
            style={{ ["--ag-font-size" ]: "12px", ["--ag-header-font-size" ]: "12px" } as any}
          >
          <AgGridReact
            rowData={filteredTraceCalls}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            domLayout="autoHeight"
            rowHeight={36}
            headerHeight={32}
          />
        </div>
      </section>
    </div>
  );
}

function asHitl(r: Row): string {
  if (!r.requires_approval) return "—";
  return r.approved_by ? "✓ approved" : "⏳ pending";
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">{children}</span>;
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "ok" | "warn" }) {
  const cls = tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-[260px]">{children}</div>
    </div>
  );
}

function OutcomeBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls =
    v === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : v === "denied" || v === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{value || "—"}</span>;
}

function CommUserCard({ comm, callCount }: { comm: Row; callCount: number }) {
  const ca = comm?.customattributes && typeof comm.customattributes === "object" ? (comm.customattributes as Record<string, unknown>) : {};
  const roles = Array.isArray(ca.sap_roles) ? (ca.sap_roles as unknown[]) : [];
  const objs = Array.isArray(ca.sap_auth_objects) ? (ca.sap_auth_objects as unknown[]) : [];
  const module = text(ca.sap_module || ca.module);
  const sys = text(ca.sap_system || ca.system);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            👤 {text(comm.displayname) || text(comm.name)}
            <OutcomeBadge value={`${text(comm.risk_level) || "medium"} risk`} />
            {text(comm.criticality) && <Badge>criticality: {text(comm.criticality)}</Badge>}
          </div>
          <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-slate-600 md:grid-cols-3">
            <span><b>nhi:</b> {text(comm.name) || "—"}</span>
            <span><b>state:</b> {text(comm.state) || "—"}</span>
            <span><b>sap module:</b> {module || "—"}</span>
            <span><b>sap system:</b> {sys || "—"}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase text-slate-500">Calls from agent</div>
          <div className="text-3xl font-bold text-indigo-700">{callCount}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-slate-50 p-3 md:col-span-1">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">SAP roles ({roles.length})</h4>
          {roles.length === 0 ? (
            <p className="text-xs text-slate-500">No roles.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-700">
              {roles.map((r, i) => (
                <li key={i}>{typeof r === "string" ? r : text((r as Record<string, unknown>).name)}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 md:col-span-2">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">Auth objects ({objs.length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-1 py-1">Object</th>
                  <th className="px-1 py-1">Field</th>
                  <th className="px-1 py-1">Values</th>
                  <th className="px-1 py-1">Activity</th>
                </tr>
              </thead>
              <tbody>
                {objs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-1 py-2 text-slate-500">No auth objects.</td>
                  </tr>
                ) : (
                  objs.flatMap((o, i) => explodeAuthObject(o as Record<string, unknown>, i))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function explodeAuthObject(o: Record<string, unknown>, keyBase: number): React.ReactNode[] {
  const name = text(o.object || o.name) || "—";
  const activity = text(o.activity || o.activities || o.actvt);
  const rows: { field: string; values: string }[] = [];
  if (o.fields && typeof o.fields === "object" && !Array.isArray(o.fields)) {
    for (const k of Object.keys(o.fields as Record<string, unknown>)) {
      const v = (o.fields as Record<string, unknown>)[k];
      rows.push({ field: k, values: Array.isArray(v) ? v.map((x) => text(x)).join(", ") : text(v) });
    }
  } else {
    const values = Array.isArray(o.values) ? (o.values as unknown[]).map((x) => text(x)).join(", ") : text(o.value);
    rows.push({ field: text(o.field), values });
  }
  return rows.map((r, j) => (
    <tr key={`${keyBase}-${j}`} className="border-b border-slate-100">
      {j === 0 && (
        <td rowSpan={rows.length} className="px-1 py-1 font-mono text-[11px] text-slate-700">
          {name}
        </td>
      )}
      <td className="px-1 py-1 font-mono text-[11px] text-slate-700">{r.field || "—"}</td>
      <td className="px-1 py-1 text-slate-700">{r.values || "—"}</td>
      {j === 0 && <td rowSpan={rows.length} className="px-1 py-1 text-slate-700">{activity || "—"}</td>}
    </tr>
  ));
}

