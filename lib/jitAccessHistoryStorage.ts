/** Persists JIT Access history for the session; cleared on logout. */

export const JIT_ACCESS_HISTORY_STORE_KEY = "jitAccessHistorySession";

export type JitAccessHistoryRow = {
  id: string;
  date: string;
  requestedDuration: number;
  startTime: string;
  endTime: string;
  status: string;
};

function readStore(): Record<string, JitAccessHistoryRow[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(JIT_ACCESS_HISTORY_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, JitAccessHistoryRow[]>)
      : {};
  } catch {
    return {};
  }
}

export function loadJitAccessHistory(userId: string): JitAccessHistoryRow[] | null {
  const rows = readStore()[userId];
  return Array.isArray(rows) && rows.length > 0 ? rows : null;
}

export function saveJitAccessHistory(userId: string, rows: JitAccessHistoryRow[]): void {
  if (typeof window === "undefined") return;
  try {
    const all = readStore();
    all[userId] = rows;
    localStorage.setItem(JIT_ACCESS_HISTORY_STORE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearJitAccessHistoryStore(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(JIT_ACCESS_HISTORY_STORE_KEY);
  } catch {
    /* ignore */
  }
}
