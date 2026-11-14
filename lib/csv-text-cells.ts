/**
 * Excel turns date-like text in a CSV into its own date format (e.g. "2026-11-03 09:28:47.358845" shows as
 * "03-11-2026 09:28", and is saved back that way). A cell written as ="<value>" is shown exactly as <value>.
 * Exports wrap timestamps that way; imports unwrap them before upload, so the backend gets the plain value.
 */

/** A date or timestamp as the backend sends it: 2026-11-03, 2026-11-03 09:28:47.358845, 2026-11-03T09:28:47Z, ... */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/** The CSV text for a value Excel must show unchanged: timestamps become ="<value>", anything else as is. */
export function excelTextCell(value: string): string {
  return TIMESTAMP.test(value) ? `="${value}"` : value;
}

/** Undoes excelTextCell in raw CSV text: ="<timestamp>" (bare, or RFC 4180-quoted as "=""<timestamp>""") -> <timestamp>. */
export function unwrapExcelTextCells(csv: string): string {
  const ts = String.raw`(\d{4}-\d{2}-\d{2}(?:[ T][0-9:.]+(?:Z|[+-][0-9:]+)?)?)`;
  return csv.replace(new RegExp(`"=""${ts}"""`, "g"), "$1").replace(new RegExp(`="${ts}"`, "g"), "$1");
}

/** A .csv upload with its ="<timestamp>" cells unwrapped; any other file is returned unchanged. */
export async function unwrapExcelTextCellsInFile(file: File): Promise<File> {
  if (!/\.csv$/i.test(file.name)) return file;
  const text = await file.text();
  const unwrapped = unwrapExcelTextCells(text);
  return unwrapped === text ? file : new File([unwrapped], file.name, { type: file.type || "text/csv" });
}
