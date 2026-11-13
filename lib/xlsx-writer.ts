/**
 * Minimal .xlsx writer (one sheet, no dependencies) with optional column locking.
 *
 * Locked columns (and the header row) are greyed out and can't be edited while the sheet is protected;
 * every other column is unlocked. The sheet is protected without a password, with sorting, filtering
 * and column resizing still allowed. Excel and LibreOffice honour the protection; it is a guard
 * against accidental edits, not a security control (Review > Unprotect Sheet removes it).
 */

export type XlsxCell = string | number | boolean | null | undefined;

export interface XlsxSheetOptions {
  sheetName?: string;
  columns: string[];
  rows: XlsxCell[][];
  /** Column names (case-insensitive) to lock for editing. */
  lockedColumns?: Iterable<string>;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Excel's limit for the text in one cell. */
const MAX_CELL_CHARS = 32767;

// Style indexes in styles.xml cellXfs
const STYLE_HEADER = 1; // bold, grey fill, locked
const STYLE_LOCKED = 2; // grey fill, locked
const STYLE_EDITABLE = 3; // unlocked

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "") // not allowed in XML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 -> A, 25 -> Z, 26 -> AA ... */
function columnLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function cellXml(ref: string, value: XlsxCell, style: number): string {
  if (value === null || value === undefined || value === "") return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  const text = escapeXml(String(value).slice(0, MAX_CELL_CHARS));
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function sheetXml({ columns, rows, lockedColumns }: XlsxSheetOptions): string {
  const locked = new Set(Array.from(lockedColumns ?? [], (c) => c.toLowerCase()));
  const styleOf = columns.map((c) => (locked.has(c.toLowerCase()) ? STYLE_LOCKED : STYLE_EDITABLE));
  const lastCol = columnLetter(Math.max(columns.length, 1) - 1);
  const lastRow = rows.length + 1;

  // Column widths from the header and the first rows, between 10 and 60 characters
  const widths = columns.map((c, i) => {
    let w = c.length;
    for (const r of rows.slice(0, 200)) w = Math.max(w, String(r[i] ?? "").length);
    return Math.min(60, Math.max(10, w + 2));
  });
  // Each column's default style also covers cells below the data, so new values keep the column's lock state
  const cols = columns
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths[i]}" style="${styleOf[i]}" customWidth="1"/>`)
    .join("");

  const header = `<row r="1">${columns
    .map((c, i) => cellXml(`${columnLetter(i)}1`, c, STYLE_HEADER))
    .join("")}</row>`;
  const body = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 2}">${columns
          .map((_, ci) => cellXml(`${columnLetter(ci)}${ri + 2}`, r[ci], styleOf[ci]))
          .join("")}</row>`
    )
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${header}${body}</sheetData>` +
    // Attributes set to 0 are actions still allowed on the protected sheet
    `<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" sort="0" autoFilter="0"/>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    `</worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyProtection="1"><protection locked="1"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyProtection="1"><protection locked="1"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="0"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

function workbookFiles(options: XlsxSheetOptions): Array<[string, string]> {
  // Sheet names: max 31 chars, none of : \ / ? * [ ]
  const sheetName = escapeXml((options.sheetName || "Sheet1").replace(/[:\\/?*[\]]/g, " ").slice(0, 31));
  return [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>` +
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sheetName.replace(/'/g, "''")}'!$A$1:$${columnLetter(Math.max(options.columns.length, 1) - 1)}$${options.rows.length + 1}</definedName></definedNames>` +
        `</workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ],
    ["xl/styles.xml", STYLES_XML],
    ["xl/worksheets/sheet1.xml", sheetXml(options)],
  ];
}

// ---- ZIP (stored, no compression) ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files: Array<[string, Uint8Array]>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true); // time
    local.setUint16(12, 0x21, true); // date: 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true); // version made by
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, 0, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true); // local header offset (other fields 0)
    central.push(new Uint8Array(entry.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Builds a one-sheet .xlsx file; `lockedColumns` and the header row are locked for editing. */
export function buildXlsx(options: XlsxSheetOptions): Blob {
  const encoder = new TextEncoder();
  const files = workbookFiles(options).map(([name, xml]) => [name, encoder.encode(xml)] as [string, Uint8Array]);
  return new Blob([zipStored(files)], { type: XLSX_MIME });
}
