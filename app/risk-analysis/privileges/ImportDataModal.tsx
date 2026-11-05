"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileText, Info, Upload } from "lucide-react";
import Modal from "@/components/Modal";
import {
  ingestImportFile,
  listAppInstances,
  listImportTypes,
  listRulesets,
  promoteImport,
  setAppSystem,
  type IngestLoadData,
} from "@/lib/api/rm";
import {
  HIDDEN_IMPORT_TYPES,
  IMPORT_TYPE_META,
  MAX_FILE_MB,
  SYSTEM_CODE_RE,
  SYSTEM_CODE_HINT,
  batchId,
  downloadTemplate,
  importTypeTitle,
  readHeaderColumns,
  systemCodeFromName,
} from "./constants";

const field = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const label = "mb-1 block text-xs font-medium text-gray-600";
const btn = "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

type Staged = { batch: string; load: IngestLoadData };

/**
 * Two steps, as in the Risk Management console: upload the file to be read and staged (ingest), then
 * apply the staged rows as a background job (import/promote) whose progress shows under Recent imports.
 */
export function ImportDataModal({
  defaultSystem,
  onClose,
  onStarted,
}: {
  defaultSystem?: string;
  onClose: () => void;
  onStarted: (message: string) => void;
}) {
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["app-instances"], queryFn: listAppInstances });
  const rulesets = useQuery({
    queryKey: ["rulesets", "import"],
    queryFn: async () => (await listRulesets(null, 1, 200)).data ?? [],
  });

  const [pickedApp, setPickedApp] = useState("");
  const appId =
    pickedApp || (defaultSystem && apps.data?.find((a) => a.system_code === defaultSystem)?.instance_id) || "";
  const app = apps.data?.find((a) => a.instance_id === appId);

  const [codeEdit, setCodeEdit] = useState<string | null>(null);
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const code = codeEdit ?? (app ? app.system_code ?? systemCodeFromName(app.instance_name) : "");
  const name = nameEdit ?? app?.instance_name ?? "";
  const codeOk = SYSTEM_CODE_RE.test(code) && code !== "GENERIC";

  // Wait for typing to pause before loading the system's file layouts.
  const [typesFor, setTypesFor] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTypesFor(codeOk ? code : ""), 300);
    return () => clearTimeout(t);
  }, [code, codeOk]);
  const types = useQuery({
    queryKey: ["import-types", typesFor],
    enabled: !!typesFor,
    queryFn: async () => (await listImportTypes(typesFor)).filter((t) => !HIDDEN_IMPORT_TYPES.has(t.artifact_code)),
  });
  const sortedTypes = useMemo(
    () =>
      [...(types.data ?? [])].sort(
        (a, b) => (IMPORT_TYPE_META[a.artifact_code]?.order ?? 99) - (IMPORT_TYPE_META[b.artifact_code]?.order ?? 99)
      ),
    [types.data]
  );
  const usesStandard = sortedTypes.length > 0 && sortedTypes.every((t) => t.standard);

  const [typeCode, setTypeCode] = useState("");
  const type = sortedTypes.find((t) => t.artifact_code === typeCode);
  const [file, setFile] = useState<File | null>(null);
  const [header, setHeader] = useState<string[] | null>(null);
  const [rulesetCode, setRulesetCode] = useState("");
  const [staged, setStaged] = useState<Staged | null>(null);

  const pickApp = (id: string) => {
    setPickedApp(id);
    setCodeEdit(null);
    setNameEdit(null);
    setTypeCode("");
    setStaged(null);
  };
  const pickFile = async (f: File | null) => {
    setFile(f);
    setStaged(null);
    setHeader(f ? await readHeaderColumns(f) : null);
  };

  // Columns the layout needs that the file's header lacks (CSV/TSV only; Excel is checked on the server).
  const columnCheck = useMemo(() => {
    if (!type || !header) return null;
    const have = new Set(header);
    const byLower = new Map(header.map((h) => [h.toLowerCase(), h]));
    const missing = type.columns.filter((c) => !have.has(c.name));
    return {
      required: missing.filter((c) => c.required).map((c) => ({ name: c.name, near: byLower.get(c.name.toLowerCase()) })),
      optional: missing.filter((c) => !c.required).map((c) => c.name),
    };
  }, [type, header]);

  const tooBig = !!file && file.size > MAX_FILE_MB * 1048576;
  const canUpload = !!app && codeOk && !!type && !!file && !tooBig && !(columnCheck && columnCheck.required.length > 0);

  const upload = useMutation({
    mutationFn: async (): Promise<Staged> => {
      if (!app || !type || !file) throw new Error("Choose an application, what the file contains, and the file.");
      // Save the system code first when it is new or was changed, so the application maps to it.
      if (app.system_source !== "saved" || app.system_code !== code || nameEdit !== null) {
        await setAppSystem(app.instance_id, code, name.trim() || undefined);
        void qc.invalidateQueries({ queryKey: ["app-instances"] });
        void qc.invalidateQueries({ queryKey: ["lookup", "SYSTEM_TYPE"] });
      }
      const batch = batchId(code, type.artifact_code);
      const res = await ingestImportFile({ systemType: code, artifactCode: type.artifact_code, batch, file });
      if (!res.load?.success || !res.load.data) throw new Error(res.load?.error ?? "The file could not be read");
      return { batch, load: res.load.data };
    },
    onSuccess: setStaged,
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!staged || !app || !type || !file) throw new Error("Upload the file first.");
      return promoteImport({
        batch: staged.batch,
        system_type: code,
        artifact_code: type.artifact_code,
        file_name: file.name,
        rows_read: staged.load.rows_in,
        rows_written: staged.load.rows_written,
        rows_skipped: staged.load.rows_skipped,
        ruleset_code: (type.artifact_code === "SOD_RULES" && rulesetCode.trim()) || undefined,
        instance_id: app.instance_id,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["import-jobs"] });
      onStarted(`Applying ${importTypeTitle(type!).toLowerCase()} from ${file!.name}. Progress is under Recent imports.`);
      onClose();
    },
  });

  const load = staged?.load;
  const footer = staged ? (
    <>
      <button type="button" className={btn} onClick={() => setStaged(null)} disabled={apply.isPending}>
        Back
      </button>
      <button
        type="button"
        className={btnPrimary}
        onClick={() => apply.mutate()}
        disabled={!load?.rows_written || apply.isPending}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {apply.isPending ? "Starting…" : `Apply ${(load?.rows_written ?? 0).toLocaleString()} rows`}
      </button>
    </>
  ) : (
    <>
      <button type="button" className={btn} onClick={onClose}>
        Cancel
      </button>
      <button type="button" className={btnPrimary} onClick={() => upload.mutate()} disabled={!canUpload || upload.isPending}>
        <Upload className="h-3.5 w-3.5" />
        {upload.isPending ? "Uploading…" : "Upload and check"}
      </button>
    </>
  );

  return (
    <Modal open title="Import data" onClose={onClose} footer={footer} wide>
      {apps.isLoading && <div className="text-slate-500">Loading…</div>}
      {apps.isError && <ErrorBox>{(apps.error as Error).message}</ErrorBox>}

      {apps.data && !staged && (
        <div className="space-y-3">
          <div>
            <label htmlFor="imp-app" className={label}>
              Application
            </label>
            <select id="imp-app" className={field} value={appId} onChange={(e) => pickApp(e.target.value)}>
              <option value="">Choose an application…</option>
              {apps.data.map((a) => (
                <option key={a.instance_id} value={a.instance_id}>
                  {a.instance_name}
                  {a.system_code ? ` — ${a.system_code}` : ""}
                </option>
              ))}
            </select>
          </div>

          {app && (
            <div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="imp-code" className={label}>
                    System code
                  </label>
                  <input
                    id="imp-code"
                    className={`${field} font-mono`}
                    value={code}
                    onChange={(e) => {
                      setCodeEdit(e.target.value.toUpperCase());
                      setTypeCode("");
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="imp-name" className={label}>
                    System name
                  </label>
                  <input id="imp-name" className={field} value={name} onChange={(e) => setNameEdit(e.target.value)} />
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {!codeOk ? (
                  <span className="text-red-800">{SYSTEM_CODE_HINT}</span>
                ) : app.system_source === "linked" && codeEdit === null ? (
                  <>
                    Its roles already map to {app.system_code} privileges. Applications with the same code share one
                    privilege catalog.
                  </>
                ) : (
                  "Applications with the same code share one privilege catalog — every Fusion instance is FUSION."
                )}
              </p>
            </div>
          )}

          {app && codeOk && types.isLoading && <div className="text-slate-500">Loading…</div>}
          {types.isError && <ErrorBox>{(types.error as Error).message}</ErrorBox>}

          {app && codeOk && usesStandard && (
            <div className="rounded-md bg-blue-50 p-2.5 text-[13px] text-blue-900">
              <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {code} has no file layouts of its own, so it uses the standard ones: the same columns for every
              application.
            </div>
          )}

          {app && codeOk && sortedTypes.length > 0 && (
            <div role="radiogroup" aria-label="What the file contains">
              <div className={label}>What the file contains</div>
              <div className="grid gap-1">
                {sortedTypes.map((t) => {
                  const on = t.artifact_code === typeCode;
                  return (
                    <label
                      key={t.artifact_code}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 ${
                        on ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="imp-type"
                        className="mt-1"
                        checked={on}
                        onChange={() => {
                          setTypeCode(t.artifact_code);
                          setStaged(null);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900">{importTypeTitle(t)}</span>
                        {on && IMPORT_TYPE_META[t.artifact_code] && (
                          <span className="block text-xs text-slate-500">{IMPORT_TYPE_META[t.artifact_code].help}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {type && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <b className="text-slate-700">Columns in the file</b>
                <button type="button" className={`${btn} px-2 py-0.5 text-xs`} onClick={() => downloadTemplate(type)}>
                  <Download className="h-3 w-3" />
                  Template
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {type.columns.map((c) => (
                  <span
                    key={c.name}
                    title={c.required ? "Required" : "Optional"}
                    className={`rounded-full border px-2 py-0.5 font-mono ${
                      c.required ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {c.name}
                    {!c.required && <span className="opacity-70"> · optional</span>}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-slate-500">
                Column names must match exactly, including case. Other columns are ignored. CSV, tab-separated or Excel
                (.xlsx).
              </p>
            </div>
          )}

          {type?.artifact_code === "SOD_RULES" && (
            <div>
              <label htmlFor="imp-ruleset" className={label}>
                Load into ruleset
              </label>
              <input
                id="imp-ruleset"
                className={field}
                list="imp-rulesets"
                value={rulesetCode}
                onChange={(e) => setRulesetCode(e.target.value.toUpperCase())}
                placeholder={`${code}_SOD`}
              />
              <datalist id="imp-rulesets">
                {(rulesets.data ?? []).map((r) => (
                  <option key={r.ruleset_id} value={r.ruleset_code ?? ""}>
                    {r.ruleset_name}
                  </option>
                ))}
              </datalist>
              <p className="mt-1 text-xs text-slate-500">
                An existing ruleset, or a new code. Left empty, rules go into {code}_SOD.
              </p>
            </div>
          )}

          {type && (
            <div>
              <label htmlFor="imp-file" className={label}>
                File
              </label>
              <input
                id="imp-file"
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xlsm"
                className="block w-full cursor-pointer rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-gray-300 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="mt-1 text-xs text-slate-500">
                  <FileText className="mr-1 inline h-3 w-3 align-[-2px]" />
                  {file.name} · {(file.size / 1048576).toFixed(1)} MB
                </p>
              )}
              {tooBig && (
                <ErrorBox>
                  The file is larger than {MAX_FILE_MB} MB, the most the server accepts. Split it, or save it as .xlsx,
                  which is smaller.
                </ErrorBox>
              )}
              {columnCheck && columnCheck.required.length > 0 && (
                <ErrorBox>
                  The file has no{" "}
                  {columnCheck.required.map((c, i) => (
                    <span key={c.name}>
                      {i > 0 && ", "}
                      <code>{c.name}</code>
                      {c.near && (
                        <>
                          {" "}
                          (it has <code>{c.near}</code> — the case must match)
                        </>
                      )}
                    </span>
                  ))}{" "}
                  column. Columns found: {header?.filter(Boolean).join(", ") || "none"}.
                </ErrorBox>
              )}
              {columnCheck && columnCheck.required.length === 0 && columnCheck.optional.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  No {columnCheck.optional.join(", ")} column — those values stay empty.
                </p>
              )}
            </div>
          )}

          {upload.isError && <ErrorBox>{(upload.error as Error).message}</ErrorBox>}
        </div>
      )}

      {staged && load && type && file && (
        <div>
          <p className="mb-2.5 text-sm">
            <b>{importTypeTitle(type)}</b> from <b>{file.name}</b>
          </p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(
              [
                ["Rows read", load.rows_in],
                ["Ready to apply", load.rows_written],
                ["Skipped", load.rows_skipped],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-md border border-slate-200 p-2.5 text-center">
                <div className={`text-xl font-semibold ${k === "Skipped" && v > 0 ? "text-amber-700" : "text-slate-900"}`}>
                  {v.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">{k}</div>
              </div>
            ))}
          </div>
          {load.rows_skipped > 0 && <SkippedRows load={load} />}
          {load.rows_written === 0 ? (
            <ErrorBox>No row could be read with this system’s column mapping, so there is nothing to apply.</ErrorBox>
          ) : (
            <p className="text-xs text-slate-500">
              Applying runs in the background — a large file can take several minutes. Close this window whenever you
              like; the outcome appears under Recent imports.
            </p>
          )}
          {apply.isError && <ErrorBox>{(apply.error as Error).message}</ErrorBox>}
        </div>
      )}
    </Modal>
  );
}

function SkippedRows({ load }: { load: IngestLoadData }) {
  const reasons = Array.isArray(load.skip_reasons)
    ? load.skip_reasons.map((r) => [`no ${String(r.column ?? "value").replace(/_/g, " ")}`, Number(r.rows_null ?? 0)] as const)
    : [];
  const sample = load.skipped_sample ?? [];
  return (
    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs">
      <div className="mb-1 font-semibold text-amber-900">
        <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Skipped rows are left out when you apply
      </div>
      {reasons.map(([why, n]) => (
        <div key={why}>
          {n.toLocaleString()} {n === 1 ? "row" : "rows"} with {why}
        </div>
      ))}
      {sample.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer">Examples</summary>
          <pre className="mt-1 whitespace-pre-wrap text-[11px]">
            {sample
              .slice(0, 5)
              .map((s) => JSON.stringify(s))
              .join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</div>;
}
