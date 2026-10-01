"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, Download, Upload } from "lucide-react";
import Modal from "@/components/Modal";
import { getJwtAuthHeaders } from "@/lib/auth";
import { triggerDownload } from "@/lib/rm-csv";

export type CatalogFileFormat = "csv" | "xlsx";

type CatalogFileResult = { ok: boolean; title: string; message: string };

const FORMAT_LABELS: Record<CatalogFileFormat, string> = { csv: "Download CSV", xlsx: "Download Excel" };

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

const iconButtonClass = (busy: boolean) =>
  `w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-200 ${
    busy ? "opacity-50 cursor-not-allowed bg-gray-200" : "hover:bg-gray-200 cursor-pointer"
  }`;

/** Pop-up showing the outcome of an import or export. */
function CatalogFileResultModal({ result, onClose }: { result: CatalogFileResult | null; onClose: () => void }) {
  return (
    <Modal
      open={result != null}
      title={result?.title}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700"
        >
          OK
        </button>
      }
    >
      <div className="flex items-start gap-3">
        {result?.ok ? (
          <CircleCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <CircleX className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        <p className="break-words whitespace-pre-wrap">{result?.message}</p>
      </div>
    </Modal>
  );
}

interface CatalogExportButtonProps {
  /** Full export URL for the chosen format */
  buildUrl: (format: CatalogFileFormat) => string;
  /** Download file name (without extension) when the response has no Content-Disposition */
  fileName: string;
  /** One format downloads on click; several open a menu */
  formats?: CatalogFileFormat[];
  title?: string;
}

/** Download icon that GETs an export file and saves it. */
export function CatalogExportButton({
  buildUrl,
  fileName,
  formats = ["csv", "xlsx"],
  title = "Export",
}: CatalogExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CatalogFileResult | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const exportFile = async (format: CatalogFileFormat) => {
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(buildUrl(format), { headers: getJwtAuthHeaders() });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(pickString(json?.errorMessage, json?.message) || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
      triggerDownload(blob, name ? decodeURIComponent(name) : `${fileName}.${format}`);
    } catch (e) {
      setResult({ ok: false, title: "Export failed", message: e instanceof Error ? e.message : "Export failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => (formats.length === 1 ? void exportFile(formats[0]) : setOpen((v) => !v))}
        disabled={busy}
        className={iconButtonClass(busy)}
        title={busy ? "Exporting…" : title}
        aria-label={title}
        aria-haspopup={formats.length > 1 ? "menu" : undefined}
        aria-expanded={formats.length > 1 ? open : undefined}
      >
        <Download className="w-5 h-5 text-gray-700" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1"
        >
          {formats.map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => void exportFile(format)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
      )}
      <CatalogFileResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
}

interface CatalogImportButtonProps {
  /** Full import URL */
  buildUrl: () => string;
  onImported: () => void;
  title?: string;
}

/** Upload icon that POSTs a .csv/.xlsx in the multipart field `file`. */
export function CatalogImportButton({ buildUrl, onImported, title = "Import (.csv or .xlsx)" }: CatalogImportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CatalogFileResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(buildUrl(), { method: "POST", headers: getJwtAuthHeaders(), body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(pickString(json?.errorMessage, json?.message) || `Import failed (${res.status})`);
      }
      setResult({
        ok: true,
        title: "Import complete",
        message: pickString(json?.message) || `${file.name} was imported successfully.`,
      });
      onImported();
    } catch (e) {
      setResult({ ok: false, title: "Import failed", message: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={iconButtonClass(busy)}
        title={busy ? "Importing…" : title}
        aria-label={title}
      >
        <Upload className="w-5 h-5 text-gray-700" />
      </button>
      <CatalogFileResultModal result={result} onClose={() => setResult(null)} />
    </>
  );
}
