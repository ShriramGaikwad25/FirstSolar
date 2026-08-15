"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listRulesets,
  upsertRuleset,
  triggerAnalysis,
  exportRulesetJson,
  exportRulesetCsv,
  importRulesetJson,
  importRulesetCsv,
  type ImportRulesetCsvInput,
} from "@/lib/api/rm";
import { useLookup } from "@/hooks/useLookup";
import { csvToRows, rowsToCsv, triggerDownload } from "@/lib/rm-csv";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { Plus, Play, Upload, Download, FileJson, FileSpreadsheet } from "lucide-react";
import type { RulesetCsvRow } from "@/types/rm-dashboard";

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

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rulesets</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New ruleset
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {q.isLoading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
        {q.isError && (
          <div className="p-4 text-sm text-red-600">
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[28%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
              <col className="w-[34%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Name</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-center">Rules</th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.ruleset_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 px-3 truncate">
                    <span className="font-semibold text-gray-900">
                      {r.ruleset_code ?? "—"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-800 truncate">{r.ruleset_name ?? "—"}</td>
                  <td className="py-2.5 px-3">
                    {r.status != null && r.status !== "" ? (
                      <Badge label={r.status} color={statusColor(r.status)} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-gray-800">
                    {r.active_rule_count ?? 0}
                  </td>
                  <td className="py-2.5 pl-3 pr-2 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        title="Download as JSON / CSV"
                        onClick={() =>
                          setDownloadFor({ id: r.ruleset_id, code: r.ruleset_code || "ruleset" })
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        disabled={run.isPending}
                        onClick={() => run.mutate(r.ruleset_id)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Run analysis
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
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
      {previewJson && (
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
