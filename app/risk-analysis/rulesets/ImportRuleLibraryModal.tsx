"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Play, SearchCheck, Upload } from "lucide-react";
import Modal from "@/components/Modal";
import { importRuleLibrary, listRulesets, type RuleLibraryFileKind, type RuleLibraryReport } from "@/lib/api/rm";
import { csvHeadersAndRowCount, triggerDownload } from "@/lib/rm-csv";

type Column = { name: string; required?: boolean; note?: string };

const FILES: Record<RuleLibraryFileKind, { title: string; what: string; columns: Column[]; template: string }> = {
  functions: {
    title: "Functions",
    what: "One row per function and privilege. Functions can come from different systems. Leave out when the rules use existing functions.",
    columns: [
      { name: "SYSTEM", required: true, note: "the system code, e.g. FUSION" },
      { name: "FUNCTION_NAME", required: true },
      { name: "FUNCTION_CODE", note: "blank: FN_ and the name in capitals" },
      { name: "PRIVILEGE_CODE", required: true, note: "or a role’s code, with ACCESS_POINT_TYPE Role" },
      { name: "ACCESS_POINT_TYPE", note: "Privilege or Role; blank: a privilege, else a role" },
      { name: "DESCRIPTION" },
    ],
    template: `SYSTEM,FUNCTION_NAME,FUNCTION_CODE,PRIVILEGE_CODE,ACCESS_POINT_TYPE,DESCRIPTION
FUSION,Create Payables Invoice,,AP_CREATE_PAYABLES_INVOICE_PRIV,Privilege,Enter supplier invoices in Payables
FUSION,Approve Payables Invoice,,AP_APPROVE_PAYABLES_INVOICE_PRIV,Privilege,Approve supplier invoices for payment
FUSION,Create Payment,,AP_CREATE_PAYMENT_PRIV,Privilege,Pay supplier invoices
FUSION,Maintain Suppliers,,POZ_CREATE_SUPPLIER_PRIV,Privilege,Create and change suppliers
FUSION,Maintain Suppliers,,POZ_MAINTAIN_SUPPLIER_PRIV,Privilege,
FUSION,Payables Manager Access,FN_AP_MANAGER_ACCESS,ORA_AP_ACCOUNTS_PAYABLE_MANAGER_JOB,Role,A role as the access point: anyone holding the role has this function
SAP,Post Vendor Invoice,,FB60,Privilege,SAP transaction FB60
SAP,Run Payment Program,,F110,Privilege,SAP transaction F110
`,
  },
  rules: {
    title: "Rules",
    what: "One row per rule. A function is named by code or name, new or already loaded; SYSTEM can stay blank when that is unique.",
    columns: [
      { name: "RULE_CODE", note: "blank: made from the name" },
      { name: "RULE_NAME", required: true },
      { name: "FUNCTION_A", required: true },
      { name: "SYSTEM_A" },
      { name: "FUNCTION_B", required: true },
      { name: "SYSTEM_B" },
      { name: "SEVERITY", note: "HIGH, MEDIUM, LOW or CRITICAL" },
      { name: "RISK_SCORE", note: "0–100; blank: from the severity" },
      { name: "SCOPE_ENFORCEMENT", note: "SAME_SCOPE (default) or ALWAYS…" },
      { name: "OWNER", note: "usernames or e-mail addresses, ; between several" },
      { name: "DESCRIPTION" },
    ],
    template: `RULE_CODE,RULE_NAME,FUNCTION_A,SYSTEM_A,FUNCTION_B,SYSTEM_B,SEVERITY,RISK_SCORE,SCOPE_ENFORCEMENT,OWNER,DESCRIPTION
P2P_001,Create and approve payables invoices,Create Payables Invoice,FUSION,Approve Payables Invoice,FUSION,HIGH,85,SAME_SCOPE,jane.doe@example.com,A user can enter a supplier invoice and approve it for payment.
P2P_002,Maintain suppliers and pay them,Maintain Suppliers,FUSION,Create Payment,FUSION,CRITICAL,,ALWAYS,jane.doe@example.com;ap.controls@example.com,A user can set up a supplier and pay it (fictitious vendor). Blank risk score: taken from the severity.
P2P_003,Approve invoices and pay them,Approve Payables Invoice,FUSION,Create Payment,FUSION,HIGH,80,SAME_SCOPE,,
XAPP_001,Invoice in Fusion and pay from SAP,Create Payables Invoice,FUSION,Run Payment Program,SAP,CRITICAL,95,ALWAYS,,Side A in Fusion and side B in SAP.
`,
  },
  rule_functions: {
    title: "More functions on a side",
    what: "Optional. Only for a rule with several functions on one side: one row per extra function.",
    columns: [
      { name: "RULE_CODE", required: true },
      { name: "SIDE", required: true, note: "A or B" },
      { name: "FUNCTION", required: true },
      { name: "SYSTEM" },
    ],
    template: `RULE_CODE,SIDE,FUNCTION,SYSTEM
P2P_002,B,Run Payment Program,SAP
P2P_001,A,Payables Manager Access,FUSION
`,
  },
};
const KINDS = Object.keys(FILES) as RuleLibraryFileKind[];

/** Header names as the backend matches them: case, spaces and dashes don't matter. */
const normalizeHeader = (h: string) => h.trim().toUpperCase().replace(/[\s-]+/g, "_");

/** Required columns a file's header lacks (the backend accepts a code in place of a name). */
function missingColumns(kind: RuleLibraryFileKind, headers: string[], hasRuleFunctions: boolean): string[] {
  const have = new Set(headers);
  if (kind === "functions") {
    const missing = ["SYSTEM", "PRIVILEGE_CODE"].filter((c) => !have.has(c));
    if (!have.has("FUNCTION_NAME") && !have.has("FUNCTION_CODE")) missing.push("FUNCTION_NAME");
    return missing;
  }
  if (kind === "rules") {
    const missing = !have.has("RULE_NAME") && !have.has("RULE_CODE") ? ["RULE_NAME"] : [];
    // With an extra-functions file a side's functions can all come from there.
    if (!hasRuleFunctions) missing.push(...["FUNCTION_A", "FUNCTION_B"].filter((c) => !have.has(c)));
    return missing;
  }
  return ["RULE_CODE", "SIDE", "FUNCTION"].filter((c) => !have.has(c));
}

/** Only CSV is read in the browser; TSV and Excel are checked by the server. */
const readableHere = (f: File) => /\.csv$/i.test(f.name) || !/\.[^.]+$/.test(f.name);

type Picked = { file: File; headers: string[] | null; rows: number | null };

const RULESET_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;

const field = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const fileInput =
  "block w-full cursor-pointer rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-gray-300 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100";
const btn = "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

export function ImportRuleLibraryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const rulesets = useQuery({
    queryKey: ["rulesets", "import"],
    queryFn: async () => (await listRulesets(null, 1, 200)).data ?? [],
  });
  const [rulesetCode, setRulesetCode] = useState("");
  const [rulesetName, setRulesetName] = useState("");
  const [mode, setMode] = useState<"UPSERT" | "REPLACE">("UPSERT");
  const [files, setFiles] = useState<Partial<Record<RuleLibraryFileKind, Picked>>>({});
  const [readError, setReadError] = useState("");
  const existing = rulesets.data?.find((r) => r.ruleset_code === rulesetCode.trim());

  const pick = async (kind: RuleLibraryFileKind, file: File | null) => {
    setReadError("");
    check.reset();
    run.reset();
    if (!file) {
      setFiles((f) => ({ ...f, [kind]: undefined }));
      return;
    }
    if (!readableHere(file)) {
      setFiles((f) => ({ ...f, [kind]: { file, headers: null, rows: null } }));
      return;
    }
    try {
      const { headers, rows } = csvHeadersAndRowCount(await file.text(), normalizeHeader);
      setFiles((f) => ({ ...f, [kind]: { file, headers, rows } }));
    } catch (e) {
      setReadError(`${file.name}: ${(e as Error).message}`);
    }
  };

  const hasRuleFunctions = !!files.rule_functions && files.rule_functions.rows !== 0;
  const problems = KINDS.flatMap((kind) => {
    const f = files[kind];
    if (!f || f.headers === null) return [];
    if (!f.rows) return kind === "rule_functions" ? [] : [`${f.file.name} has no rows.`];
    const missing = missingColumns(kind, f.headers, hasRuleFunctions);
    return missing.length ? [`${f.file.name} has no ${missing.join(", ")} column${missing.length > 1 ? "s" : ""}.`] : [];
  });
  if (files.rule_functions && !files.rules) problems.push("The extra-functions file needs the rules file with it.");
  if (files.rules && !RULESET_CODE_RE.test(rulesetCode.trim()))
    problems.push("Name the ruleset the rules go into: letters, digits and _ . : -");
  const ready = (!!files.functions || !!files.rules) && problems.length === 0;

  const send = (dryRun: boolean) =>
    importRuleLibrary({
      functions: files.functions?.file,
      rules: files.rules?.file,
      rule_functions: files.rule_functions?.file,
      ruleset_code: rulesetCode.trim() || undefined,
      ruleset_name: rulesetName.trim() || undefined,
      mode,
      check: dryRun,
    });
  const check = useMutation({ mutationFn: () => send(true) });
  const run = useMutation({ mutationFn: () => send(false), onSuccess: onDone });
  const busy = check.isPending || run.isPending;

  if (run.data) {
    return (
      <Modal
        open
        title="Import functions and rules"
        onClose={onClose}
        wide
        footer={
          <button type="button" className={btnPrimary} onClick={onClose}>
            Done
          </button>
        }
      >
        <Report r={run.data.report} />
      </Modal>
    );
  }

  const footer = (
    <>
      <button type="button" className={btn} onClick={onClose}>
        Cancel
      </button>
      <button
        type="button"
        className={btn}
        disabled={!ready || busy}
        onClick={() => check.mutate()}
        title="Run the import and show what it would do, without saving anything"
      >
        <SearchCheck className="h-3.5 w-3.5" />
        {check.isPending ? "Checking…" : "Check"}
      </button>
      <button type="button" className={btnPrimary} disabled={!ready || busy} onClick={() => run.mutate()}>
        <Upload className="h-3.5 w-3.5" />
        {run.isPending ? "Importing…" : "Import"}
      </button>
    </>
  );

  return (
    <Modal open title="Import functions and rules" onClose={onClose} footer={footer} wide>
      <p className="mb-3 text-xs text-slate-500">
        Each fact once: a function’s privileges in one file, each rule in one row of another. Any file can come alone —
        rules only, when their functions are already loaded. A function’s privileges and a rule’s functions are set to
        what the files say; a rule’s user conditions and mitigations stay. CSV, TSV or Excel.
      </p>

      {KINDS.map((kind) => (
        <FilePicker key={kind} kind={kind} picked={files[kind]} onPick={(f) => void pick(kind, f)} />
      ))}

      {files.rules && (
        <div className="mb-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rl-code" className="mb-1 block text-xs font-medium text-gray-600">
                Ruleset
              </label>
              <input
                id="rl-code"
                className={field}
                list="rl-rulesets"
                value={rulesetCode}
                onChange={(e) => {
                  setRulesetCode(e.target.value);
                  check.reset();
                }}
                placeholder="Existing or new code"
              />
              <datalist id="rl-rulesets">
                {(rulesets.data ?? []).map((r) => (
                  <option key={r.ruleset_id} value={r.ruleset_code ?? ""}>
                    {r.ruleset_name}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="rl-name" className="mb-1 block text-xs font-medium text-gray-600">
                Name {existing ? "(kept if blank)" : "(new ruleset)"}
              </label>
              <input
                id="rl-name"
                className={field}
                value={rulesetName}
                onChange={(e) => {
                  setRulesetName(e.target.value);
                  check.reset();
                }}
                placeholder={existing?.ruleset_name ?? ""}
              />
            </div>
          </div>
          <div role="radiogroup" aria-label="Mode" className="space-y-1">
            {(
              [
                ["UPSERT", "Add and update", "Rules not in the file stay as they are."],
                ["REPLACE", "Replace the ruleset’s rules", "Rules not in the file are deactivated."],
              ] as const
            ).map(([value, title, note]) => (
              <label key={value} className="flex items-baseline gap-2 text-sm">
                <input
                  type="radio"
                  name="rl-mode"
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    check.reset();
                  }}
                />
                <span>
                  <b>{title}</b> <span className="text-xs text-slate-500">— {note}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {check.data && (
        <div className="mb-2.5 rounded-md border border-blue-200 bg-blue-50 p-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-800">
            <SearchCheck className="h-3.5 w-3.5" />
            Checked — nothing was saved. This is what Import will do:
          </div>
          <Report r={check.data.report} checking />
        </div>
      )}
      {readError && <ErrorBox>{readError}</ErrorBox>}
      {problems.map((p) => (
        <ErrorBox key={p}>{p}</ErrorBox>
      ))}
      {check.isError && <ErrorBox>{(check.error as Error).message}</ErrorBox>}
      {run.isError && <ErrorBox>{(run.error as Error).message}</ErrorBox>}
    </Modal>
  );
}

function FilePicker({
  kind,
  picked,
  onPick,
}: {
  kind: RuleLibraryFileKind;
  picked?: Picked;
  onPick: (f: File | null) => void;
}) {
  const meta = FILES[kind];
  return (
    <div className="mb-2.5 rounded-md border border-slate-200 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <b className="text-[13px] text-slate-900">{meta.title}</b>
        <button
          type="button"
          className={`${btn} px-2 py-0.5 text-xs`}
          onClick={() => triggerDownload(new Blob([meta.template], { type: "text/csv" }), `${kind}.csv`)}
        >
          <Download className="h-3 w-3" />
          Template
        </button>
      </div>
      <p className="mb-1.5 mt-0.5 text-slate-500">{meta.what}</p>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {meta.columns.map((c) => (
          <span
            key={c.name}
            title={c.note ?? (c.required ? "Required" : "Optional")}
            className={`rounded-full border px-2 py-0.5 font-mono ${
              c.required ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-100 text-slate-600"
            }`}
          >
            {c.name}
          </span>
        ))}
      </div>
      <input
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xlsm,text/csv"
        aria-label={`${meta.title} file`}
        className={fileInput}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {picked && (
        <p className="mt-1 text-slate-500">
          {picked.rows === null ? "rows counted when checked" : `${picked.rows.toLocaleString()} rows`}
        </p>
      )}
    </div>
  );
}

/** What an import did (or, when checking, would do). */
function Report({ r, checking = false }: { r: RuleLibraryReport; checking?: boolean }) {
  const systems = Object.entries(r.functions.by_system ?? {});
  const rules = r.rules;
  const unused = rules.rule_functions_unused ?? [];
  const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

  return (
    <div className="space-y-3.5 text-[13px]">
      {r.functions.rows_in > 0 && (
        <section>
          <b>Functions</b>
          {systems.map(([sys, s]) => (
            <div key={sys} className="text-xs text-slate-500">
              {sys}: {s.functions} {plural(s.functions, "function")} ({s.created} new), {s.privilege_links} privilege links
              {s.roles_as_access_points > 0 && `, ${s.roles_as_access_points} roles as access points`}
            </div>
          ))}
          {systems
            .filter(([, s]) => s.missing_count > 0)
            .map(([sys, s]) => (
              <Warn key={sys}>
                {sys}: {s.missing_count} privilege {plural(s.missing_count, "code")} not in the catalog, left out —{" "}
                {s.privileges_missing.slice(0, 8).join(", ")}
                {s.missing_count > 8 ? "…" : ""}
              </Warn>
            ))}
          {r.functions.rows_incomplete > 0 && (
            <Warn>
              {r.functions.rows_incomplete} {plural(r.functions.rows_incomplete, "row")} without a system, function or
              privilege, skipped (rows {r.functions.incomplete_rows.join(", ")})
            </Warn>
          )}
          {r.functions.errors.map((e) => (
            <Warn key={`${e.system}:${e.error}`}>
              {e.system}: {e.error}
            </Warn>
          ))}
        </section>
      )}

      {rules.rows_in > 0 && (
        <section>
          <b>Rules</b> <span className="text-xs text-slate-500">into {r.ruleset_code}</span>
          <div className="my-1.5 grid grid-cols-4 gap-1.5">
            {(
              [
                ["Created", rules.created],
                ["Updated", rules.updated],
                ["Skipped", rules.skipped],
                ["Deactivated", rules.deactivated],
              ] as const
            ).map(([k, n]) => (
              <div key={k} className="rounded-md border border-slate-200 p-1.5 text-center">
                <div className={`text-lg font-semibold ${k === "Skipped" && n > 0 ? "text-amber-700" : "text-slate-900"}`}>{n}</div>
                <div className="text-[11px] text-slate-500">{k}</div>
              </div>
            ))}
          </div>
          {rules.unresolved.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
              <div className="mb-0.5 font-semibold text-amber-900">
                {checking ? "Would be skipped" : "Skipped — left as they were"}
              </div>
              {rules.unresolved.map((u) => (
                <div key={u.rule}>
                  <b>{u.rule}</b>:{" "}
                  {u.functions
                    .map((f) => `side ${f.side} “${f.function}”${f.system ? ` (${f.system})` : ""} — ${f.why}`)
                    .join("; ")}
                  {u.missing_side && `side ${u.missing_side} has no function`}
                </div>
              ))}
            </div>
          )}
          {rules.severity_defaulted > 0 && (
            <Warn>
              {rules.severity_defaulted} {plural(rules.severity_defaulted, "severity", "severities")} not
              HIGH/MEDIUM/LOW/CRITICAL, set to MEDIUM
            </Warn>
          )}
          {rules.scope_defaulted > 0 && (
            <Warn>
              {rules.scope_defaulted} unknown scope enforcement {plural(rules.scope_defaulted, "value")}, set to SAME_SCOPE
            </Warn>
          )}
          {rules.duplicate_codes > 0 && (
            <Warn>
              {rules.duplicate_codes} rule {plural(rules.duplicate_codes, "code")} repeated in the rules file — the first
              row of each was used
            </Warn>
          )}
          {rules.without_name > 0 && (
            <Warn>
              {rules.without_name} {plural(rules.without_name, "row")} without a rule name or code, skipped
            </Warn>
          )}
          {unused.length > 0 && (
            <Warn>
              {unused.length} extra-function {plural(unused.length, "row")} unused (no such rule in the rules file, or no
              side A/B): rows {unused.map((u) => u.row).join(", ")}
            </Warn>
          )}
          {rules.found_by_name.length > 0 && (
            <div className="mt-1 text-xs text-slate-500">
              Found by name:{" "}
              {rules.found_by_name
                .slice(0, 6)
                .map((f) => `“${f.function}” → ${f.matched}`)
                .join(", ")}
              {rules.found_by_name.length > 6 && "…"}
            </div>
          )}
        </section>
      )}

      {(r.owners?.set ?? 0) > 0 && (
        <section>
          <b>Owners</b>
          <div className="text-xs text-slate-500">{r.owners!.set} set</div>
          {r.owners!.unresolved.length > 0 && <Warn>No user found for {r.owners!.unresolved.join(", ")} — kept as written</Warn>}
        </section>
      )}

      {!checking && rules.created + rules.updated + rules.deactivated > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-green-800">
          <Play className="h-3.5 w-3.5" />
          Run the analysis on {r.ruleset_code} to see the violations these rules find.
        </div>
      )}
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="my-1 flex items-start gap-1.5 text-xs text-amber-800">
      <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none" />
      <span>{children}</span>
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</div>;
}
