import type { ImportJob, ImportJobStatus, ImportType } from "@/types/rm-privileges";

export const PAGE_SIZE = 50;

/** Largest file the ingest endpoint accepts, in MB. */
export const MAX_FILE_MB = 64;

export const PRIVILEGE_KIND: Record<string, { label: string; color: string }> = {
  PERMISSION: { label: "Privilege", color: "#2563eb" },
  ROLE: { label: "Role", color: "#7c3aed" },
  SCOPE: { label: "Scope", color: "#0891b2" },
  ACTION: { label: "Action", color: "#0d9488" },
  AUTH_OBJECT: { label: "Auth object", color: "#64748b" },
  DATA_SECURITY: { label: "Data security", color: "#b45309" },
};

/** File layouts in the order and with the wording the Import data dialog shows them. */
export const IMPORT_TYPE_META: Record<string, { order: number; title: string; help: string }> = {
  PRIVILEGES: {
    order: 1,
    title: "Privileges",
    help: "The system’s privileges with their names and descriptions. Rows are added or updated; privileges not in the file stay as they are.",
  },
  ROLE_PRIVILEGE: {
    order: 2,
    title: "Role to privilege mapping",
    help: "Which privileges each role grants directly. Privileges a role inherits are worked out from the role hierarchy.",
  },
  ROLE_HIERARCHY: {
    order: 3,
    title: "Role hierarchy",
    help: "Which roles inherit which, one parent and child per row.",
  },
  DATA_SCOPE: {
    order: 4,
    title: "User to data scope",
    help: "The data each user’s role is limited to — business unit, ledger, company code and the like.",
  },
  SCOPE_LINK: {
    order: 5,
    title: "Scope links",
    help: "Which scopes a value a requester names stands for, such as a company code that means a business unit and a ledger.",
  },
  ACCESS_ENTITLEMENT: {
    order: 6,
    title: "Function library",
    help: "Functions and the privileges or roles each is made of, by code. A function’s code is FN_ followed by its name in capitals.",
  },
  ACCESS_ENTITLEMENT_CSV: {
    order: 7,
    title: "Function library (by name)",
    help: "Functions and their access points by display name, as in a customer spreadsheet. Names are matched to privileges first, then roles.",
  },
  SOD_RULES: {
    order: 8,
    title: "SoD rules",
    help: "Conflicting function pairs with a severity (Fusion’s file: a priority), loaded into the ruleset you choose. The functions must exist first — import the function library before the rules.",
  },
};

/** Layouts that come from the identity sync, not from a file. */
export const HIDDEN_IMPORT_TYPES = new Set(["ROLE_CATALOG", "USERS", "ROLES", "USER_ROLE_ASSIGN"]);

export const importTypeTitle = (t: ImportType) => IMPORT_TYPE_META[t.artifact_code]?.title ?? t.artifact_name;

export const artifactTitle = (code: string | null | undefined) =>
  (code && IMPORT_TYPE_META[code]?.title) ||
  (code ?? "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** A system code starts with a letter: capitals, digits and _, 2–50 characters. */
export const SYSTEM_CODE_RE = /^[A-Z][A-Z0-9_]{1,49}$/;
export const SYSTEM_CODE_HINT =
  "The code starts with a letter and uses only capital letters, digits and _ (2–50 characters).";

/** Suggested system code from an application name. */
export const systemCodeFromName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "APP_$1")
    .slice(0, 50);

export const JOB_STATUS: Record<ImportJobStatus, { label: string; color: string }> = {
  QUEUED: { label: "Waiting", color: "#64748b" },
  RUNNING: { label: "Applying", color: "#2563eb" },
  DONE: { label: "Applied", color: "#16a34a" },
  FAILED: { label: "Failed", color: "#dc2626" },
};

export const isJobActive = (j: ImportJob) => j.status === "QUEUED" || j.status === "RUNNING";

export function jobDuration(j: ImportJob): string {
  if (!j.started_at) return "";
  const end = j.finished_at ? Date.parse(j.finished_at) : Date.now();
  const s = Math.max(0, Math.round((end - Date.parse(j.started_at)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Batch id for a staged upload, e.g. FUSION_PRIVILEGES_20261105_142233. */
export const batchId = (systemCode: string, artifactCode: string) =>
  `${systemCode}_${artifactCode}_${new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15)}`;

/** Header row of a CSV/TSV file (null for Excel, which only the server reads). */
export async function readHeaderColumns(file: File): Promise<string[] | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "tsv", "txt"].includes(ext)) return null;
  const line = (await file.slice(0, 65536).text()).replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const sep = ext === "csv" ? "," : "\t";
  const cols: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      cols.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

/** Downloads a CSV with just the layout's header row. */
export function downloadTemplate(t: ImportType) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const blob = new Blob([t.columns.map((c) => esc(c.name)).join(",") + "\n"], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${t.artifact_code.toLowerCase()}_template.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
