/** Chart helpers ported from NHI_V2 inventory / dashboard pages. */

export const NHI_V2_PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#14b8a6",
  "#f472b6",
];

export function groupCount(
  rows: Record<string, unknown>[],
  key: string
): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r[key] == null || r[key] === "" ? "(null)" : String(r[key]);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function sumBy(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}
