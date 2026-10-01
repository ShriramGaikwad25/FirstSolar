"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listRulesets,
  upsertRuleset,
  triggerAnalysis,
  exportRulesetJson,
  exportRulesetCsv,
  importRulesetJson,
  importRulesetCsv,
  copyRuleset,
  type ImportRulesetCsvInput,
} from "@/lib/api/rm";
import { useLookup } from "@/hooks/useLookup";
import { csvToRows, rowsToCsv, triggerDownload } from "@/lib/rm-csv";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import {
  Plus,
  Play,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  Copy,
  Search,
  Library,
} from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  RowClassParams,
} from "ag-grid-enterprise";
import CustomPagination from "@/components/agTable/CustomPagination";
import type { RmRuleset, RulesetCsvRow } from "@/types/rm-dashboard";

const RULESET_STATUS = "RULESET_STATUS";

export default function RulesetsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ruleset_code: "", ruleset_name: "", description: "" });
  const statuses = useLookup(RULESET_STATUS);

  const q = useQuery({
    queryKey: ["rulesets"],
    queryFn: async () => (await listRulesets()).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => upsertRuleset(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rulesets"] });
      setOpen(false);
      setForm({ ruleset_code: "", ruleset_name: "", description: "" });
    },
  });

  const run = useMutation({
    mutationFn: async (rulesetId: number) => triggerAnalysis(rulesetId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["analysis-runs"] });
    },
  });

  const statusColor = (code: string) =>
    statuses.data?.find((s) => s.value_code === code)?.color_hex ?? "#64748b";

  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloadFor, setDownloadFor] = useState<null | { id: number; code: string }>(null);
  const [copyFrom, setCopyFrom] = useState<null | { id: number; code: string }>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);

  const statusOptions = useMemo(
    () => [...new Set((q.data ?? []).map((r) => r.status).filter((s): s is string => !!s))],
    [q.data]
  );

  const filteredRulesets = useMemo(() => {
    let rows = q.data ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (r) =>
          String(r.ruleset_code ?? "").toLowerCase().includes(term) ||
          String(r.ruleset_name ?? "").toLowerCase().includes(term)
      );
    }
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    return rows;
  }, [q.data, search, statusFilter]);

  const totalPages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredRulesets.length / pageSize));
  // Filtering can shrink the list below the current page; clamp instead of resetting in an effect.
  const page = Math.min(currentPage, totalPages);
  const paginatedRulesets = useMemo(() => {
    if (pageSize === "all") return filteredRulesets;
    const start = (page - 1) * pageSize;
    return filteredRulesets.slice(start, start + pageSize);
  }, [filteredRulesets, page, pageSize]);

  const actionButton =
    "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 disabled:opacity-50 whitespace-nowrap";

  const columnDefs = useMemo<ColDef<RmRuleset>[]>(
    () => [
      {
        headerName: "Code",
        field: "ruleset_code",
        flex: 1,
        minWidth: 160,
        tooltipField: "ruleset_code",
        valueGetter: (p) => p.data?.ruleset_code ?? "—",
        cellClass: "font-semibold text-gray-900",
      },
      {
        headerName: "Name",
        field: "ruleset_name",
        flex: 2,
        minWidth: 220,
        tooltipField: "ruleset_name",
        valueGetter: (p) => p.data?.ruleset_name ?? "—",
      },
      {
        headerName: "Status",
        field: "status",
        width: 120,
        cellRenderer: (p: ICellRendererParams<RmRuleset>) =>
          p.value ? <Badge label={p.value} color={statusColor(p.value)} /> : "—",
      },
      {
        headerName: "Active rules",
        field: "active_rule_count",
        width: 155,
        valueGetter: (p) => p.data?.active_rule_count ?? 0,
        cellClass: "tabular-nums",
      },
      {
        headerName: "Actions",
        colId: "actions",
        width: 290,
        sortable: false,
        suppressHeaderMenuButton: true,
        resizable: false,
        cellRenderer: (p: ICellRendererParams<RmRuleset>) => {
          const r = p.data;
          if (!r) return null;
          const code = r.ruleset_code || "ruleset";
          const running = run.isPending && run.variables === r.ruleset_id;
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={actionButton}
                title="Clone this ruleset (share rules for scenario testing)"
                onClick={() => setCopyFrom({ id: r.ruleset_id, code })}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                className={actionButton}
                title="Download as JSON / CSV"
                onClick={() => setDownloadFor({ id: r.ruleset_id, code })}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                title="Run risk analysis for this ruleset"
                disabled={run.isPending}
                onClick={() => run.mutate(r.ruleset_id)}
              >
                <Play className="h-3.5 w-3.5" />
                {running ? "Running…" : "Run analysis"}
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses.data, run.isPending, run.variables]
  );

  const pagination = (
    <CustomPagination
      totalItems={filteredRulesets.length}
      currentPage={page}
      totalPages={totalPages}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(n) => {
        setPageSize(n);
        setCurrentPage(1);
      }}
      pageSizeOptions={[10, 20, 50, 100, "all"]}
    />
  );

  const fieldClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-300 pb-2">
        <h1 className="text-2xl font-bold text-blue-950">Rulesets</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            New ruleset
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="relative w-72 shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <Search className="absolute left-3 top-9 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              className={`${fieldClass} pl-9`}
              placeholder="Ruleset code or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px] max-w-xs flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              className={fieldClass}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Any status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <span className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
            <Library className="h-4 w-4" />
            Rulesets: <span className="text-blue-900">{filteredRulesets.length}</span>
          </span>
          {(search || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
              className="h-[38px] shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {q.isError && (
        <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading rulesets</p>
          <p className="text-sm">{q.error instanceof Error ? q.error.message : String(q.error)}</p>
        </div>
      )}
      {run.isSuccess && (
        <div className="mb-4 rounded-md border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-800">
          Analysis started. Results will appear on the Dashboard and Violations pages.
        </div>
      )}
      {run.isError && (
        <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Could not start analysis</p>
          <p className="text-sm">{(run.error as Error).message}</p>
        </div>
      )}

      {/* Rulesets table (AG Grid) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="mb-1 border-b border-gray-100">{pagination}</div>
        <div className="ag-theme-quartz risk-analysis-grid w-full" style={{ width: "100%", minWidth: 0 }}>
          <AgGridReact
            rowData={paginatedRulesets}
            columnDefs={columnDefs}
            getRowId={(p: GetRowIdParams<RmRuleset>) => String(p.data.ruleset_id)}
            rowClassRules={{
              "risk-analysis-row-striped": (p: RowClassParams<RmRuleset>) =>
                (p.node.rowIndex ?? 0) % 2 === 1,
            }}
            domLayout="autoHeight"
            pagination={false}
            headerHeight={44}
            rowHeight={48}
            tooltipShowDelay={300}
            defaultColDef={{
              sortable: true,
              filter: false,
              resizable: true,
              suppressSizeToFit: true,
              // Never clip a column title: wrap it and grow the header row instead.
              wrapHeaderText: true,
              autoHeaderHeight: true,
            }}
            loading={q.isLoading}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No rulesets found.</span>`}
          />
        </div>
        <div className="mt-1">{pagination}</div>
      </div>

      <Modal
        open={open}
        title="New ruleset"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.ruleset_code}
              onChange={(e) => setForm({ ...form, ruleset_code: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.ruleset_name}
              onChange={(e) => setForm({ ...form, ruleset_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {downloadFor && (
        <ExportModal
          rulesetId={downloadFor.id}
          rulesetCode={downloadFor.code}
          onClose={() => setDownloadFor(null)}
        />
      )}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ["rulesets"] });
            setUploadOpen(false);
          }}
        />
      )}
      {copyFrom && (
        <CopyModal
          sourceId={copyFrom.id}
          sourceCode={copyFrom.code}
          onClose={() => setCopyFrom(null)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ["rulesets"] });
            setCopyFrom(null);
          }}
        />
      )}
    </div>
  );
}

// Copy modal — clone a ruleset. SHARE reuses the same rule rows (cheap,
// ideal for scenario testing); DEEP duplicates every rule so edits to the
// copy don't touch the original.
function CopyModal({
  sourceId,
  sourceCode,
  onClose,
  onDone,
}: {
  sourceId: number;
  sourceCode: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState(`${sourceCode}_COPY`);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"SHARE" | "DEEP">("SHARE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    setResult("");
    try {
      const res = await copyRuleset({
        source_ruleset_id: sourceId,
        new_code: code.trim(),
        new_name: name.trim() || code.trim(),
        mode,
      });
      setResult(
        `Created ${res.data?.ruleset_code ?? code.trim()} with ${res.data?.rules_mapped ?? 0} rules (${res.data?.mode ?? mode}).`
      );
      setTimeout(onDone, 900);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`Copy ruleset — ${sourceCode}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy || !code.trim()}
            onClick={() => void submit()}
          >
            <Copy className="h-3.5 w-3.5" />
            {busy ? "Copying…" : "Create copy"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">New ruleset code</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">New ruleset name</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={name}
            placeholder={code}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Copy mode</label>
          <div className="grid gap-1.5">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                className="mt-1"
                checked={mode === "SHARE"}
                onChange={() => setMode("SHARE")}
              />
              <span>
                <b>Share rules</b> — the copy points at the same rule definitions. Edit a rule
                once, both rulesets see it. Best for spinning up scenario rulesets.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                className="mt-1"
                checked={mode === "DEEP"}
                onChange={() => setMode("DEEP")}
              />
              <span>
                <b>Deep copy</b> — duplicate every rule into the new ruleset. Independent; edits
                to the copy don&apos;t affect the source.
              </span>
            </label>
          </div>
        </div>
        {err && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}
        {result && <p className="text-[13px] text-green-600">{result}</p>}
      </div>
    </Modal>
  );
}

function ExportModal({
  rulesetId,
  rulesetCode,
  onClose,
}: {
  rulesetId: number;
  rulesetCode: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const downloadJson = async () => {
    setBusy("json");
    setErr("");
    try {
      const res = await exportRulesetJson(rulesetId);
      const payload = res.data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      triggerDownload(blob, `${rulesetCode}.json`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const downloadCsv = async () => {
    setBusy("csv");
    setErr("");
    try {
      const res = await exportRulesetCsv(rulesetId);
      const rows = res.data ?? [];
      const csv = rowsToCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      triggerDownload(blob, `${rulesetCode}.csv`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Modal
      open
      title={`Export ruleset — ${rulesetCode}`}
      onClose={onClose}
      wide
    >
      <p className="text-[13px] text-slate-600 leading-relaxed mb-3">
        <b>JSON</b> is full fidelity — includes user-attribute conditions, required permissions
        (ACTVT-level), and multi-privilege functions. Round-trip safe.
        <br />
        <br />
        <b>CSV</b> is flat Fusion-SoD-tool shape: one row per rule × side-A privilege × side-B
        privilege. Excel-friendly but will drop user conditions and required permissions.
      </p>
      {err && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!!busy}
          onClick={() => void downloadJson()}
        >
          <FileJson className="h-3.5 w-3.5" />
          {busy === "json" ? "Exporting…" : "Download JSON"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 disabled:opacity-50"
          disabled={!!busy}
          onClick={() => void downloadCsv()}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          {busy === "csv" ? "Exporting…" : "Download CSV"}
        </button>
      </div>
    </Modal>
  );
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"UPSERT" | "REPLACE">("UPSERT");
  const [csvCode, setCsvCode] = useState("");
  const [csvName, setCsvName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [previewRows, setPreviewRows] = useState<RulesetCsvRow[] | null>(null);
  const [previewJson, setPreviewJson] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string>("");

  const reset = () => {
    setPreviewRows(null);
    setPreviewJson(null);
    setResult(null);
    setErr("");
    setFileName("");
    setCsvCode("");
    setCsvName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const readFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        setPreviewJson(JSON.parse(text) as unknown);
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        const rows = csvToRows<RulesetCsvRow>(text);
        if (!rows.length) throw new Error("CSV is empty");
        setPreviewRows(rows);
        const stem = file.name.replace(/\.csv$/i, "");
        setCsvCode(stem.toUpperCase());
        setCsvName(stem);
      } else {
        throw new Error("Only .json and .csv files are accepted here. Use the CLI for .xlsx.");
      }
    } catch (e) {
      setErr((e as Error).message);
      setFileName("");
    }
  };

  const runImport = async () => {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      let res: { data: unknown };
      if (previewJson != null) {
        res = await importRulesetJson(previewJson, mode);
      } else if (previewRows) {
        if (!csvCode || !csvName) throw new Error("Ruleset code and name required for CSV import.");
        const payload: ImportRulesetCsvInput = {
          ruleset_code: csvCode,
          ruleset_name: csvName,
          rows: previewRows,
          mode,
        };
        res = await importRulesetCsv(payload);
      } else {
        throw new Error("Choose a file first.");
      }
      setResult(
        res.data != null && typeof res.data === "object"
          ? (res.data as Record<string, unknown>)
          : { value: res.data } as Record<string, unknown>
      );
      setTimeout(onDone, 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="Upload ruleset" onClose={onClose} wide>
      <p className="text-[13px] text-slate-600 leading-relaxed mb-3">
        Upload a ruleset file — <b>JSON</b> for full fidelity, or <b>CSV</b> for flat Fusion-SoD shape
        (one row per rule × side-A privilege × side-B privilege).
      </p>
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">File (.json or .csv)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
          }}
        />
        {fileName && (
          <p className="text-xs text-gray-500 mt-1">Loaded: {fileName}</p>
        )}
      </div>
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">Import mode</label>
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value as "UPSERT" | "REPLACE")}
        >
          <option value="UPSERT">
            UPSERT — create or update; leave rules not in file untouched
          </option>
          <option value="REPLACE">REPLACE — deactivate rules not in file</option>
        </select>
      </div>
      {previewRows && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ruleset code</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={csvCode}
                onChange={(e) => setCsvCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ruleset name</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={csvName}
                onChange={(e) => setCsvName(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Parsed {previewRows.length} CSV row(s). Columns detected:{" "}
            {Object.keys(previewRows[0] ?? {}).join(", ")}
          </p>
        </>
      )}
      {!!previewJson && (
        <p className="text-xs text-gray-500 mb-2">
          JSON parsed. Ruleset code:{" "}
          <b>
            {String(
              (previewJson as { ruleset?: { ruleset_code?: string } })?.ruleset?.ruleset_code ?? "—"
            )}
          </b>{" "}
          · Functions:{" "}
          {Array.isArray((previewJson as { functions?: unknown[] })?.functions)
            ? (previewJson as { functions: unknown[] }).functions.length
            : 0}{" "}
          · Rules:{" "}
          {Array.isArray((previewJson as { rules?: unknown[] })?.rules)
            ? (previewJson as { rules: unknown[] }).rules.length
            : 0}
        </p>
      )}
      {err && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      {result && (
        <div
          className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <b>Import complete.</b>{" "}
          {"ruleset_id" in result && <>ruleset_id: {String(result.ruleset_id)}</>}
          {"rules_upserted" in result && result.rules_upserted != null && (
            <> · rules_upserted: {String(result.rules_upserted)}</>
          )}
          {"rules_loaded" in result && result.rules_loaded != null && (
            <> · rules_loaded: {String(result.rules_loaded)}</>
          )}
          {"rows_seen" in result && result.rows_seen != null && (
            <> · rows_seen: {String(result.rows_seen)}</>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={busy || (!previewRows && !previewJson)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}
