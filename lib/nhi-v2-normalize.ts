/**
 * Defensive normalisation helpers for NHI v2 API responses.
 * Postgres text[] / jsonb columns may arrive as literal strings rather than parsed JS values.
 */

/** Normalise a value into a JS array of strings. */
export function toArray(v: unknown): unknown[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x) => x != null);
  if (typeof v !== "string") return [v];
  const s = v.trim();
  if (s === "" || s === "{}" || s === "[]" || s === "null") return [];

  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x) => x != null) : [parsed];
    } catch {
      /* fall through */
    }
  }

  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1);
    if (inner === "") return [];
    const out: string[] = [];
    let buf = "";
    let inQuote = false;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '"' && inner[i - 1] !== "\\") inQuote = !inQuote;
      else if (c === "," && !inQuote) {
        out.push(buf);
        buf = "";
        continue;
      }
      buf += c;
    }
    if (buf.length > 0) out.push(buf);
    return out
      .map((tok) => {
        let t = tok.trim();
        if (t === "NULL") return null;
        if (t.startsWith('"') && t.endsWith('"')) {
          t = t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        }
        return t;
      })
      .filter((x) => x != null);
  }

  return [s];
}

/** Normalise a value into a plain object (jsonb). */
export function toObject(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v !== "string") return {};
  const s = v.trim();
  if (s === "" || s === "{}") return {};
  try {
    const parsed = JSON.parse(s) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
