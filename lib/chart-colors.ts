/**
 * Dashboard chart swatches (user-provided): blue, teal, purple, green, amber;
 * sixth slot is cyan so six series stay distinct.
 */
export const CHART_SERIES_COLORS = [
  "#2979FF",
  "#00BFA5",
  "#9933FF",
  "#11C65E",
  "#F9B824",
  "#00BCD4",
] as const;

/** Same palette as series colors for horizontal bar widgets */
export const CHART_HORIZONTAL_PALETTE = [
  "#2979FF",
  "#00BFA5",
  "#9933FF",
  "#11C65E",
  "#F9B824",
  "#00BCD4",
] as const;

/** Risk bands — NHIs by Risk Level: green → amber → red → dark red */
export const CHART_RISK_LEVEL_COLORS: Record<string, string> = {
  critical: "#7F1D1D",
  high: "#DC2626",
  medium: "#F9B824",
  low: "#11C65E",
  info: "#5A7A8A",
  unknown: "#9CA3AF",
};

export function secretHealthArcColor(score: number): string {
  if (score >= 70) return "#11C65E";
  if (score >= 40) return "#F9B824";
  return "#DC2626";
}

export const CHART_TRACK_GRAY = "#E8ECF4";

/** Fixed color for `service_account` / “Service Account” on NHI type charts */
export const NHI_SERVICE_ACCOUNT_COLOR = "#FF9F43";

function isNhiServiceAccountLabel(label: string): boolean {
  const k = label.trim().toLowerCase().replace(/[\s_]+/g, "");
  return k === "serviceaccount";
}

/**
 * One color per NHI type (sorted label order) so the type donut and lifecycle
 * stacked bar use the same legend colors for the same type.
 * Service Account always uses {@link NHI_SERVICE_ACCOUNT_COLOR}.
 */
export function buildNhiTypeLegendColorMap(labels: string[]): Map<string, string> {
  const sorted = [...new Set(labels.map((l) => l.trim()))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  const map = new Map<string, string>();
  let paletteIdx = 0;
  for (const label of sorted) {
    if (isNhiServiceAccountLabel(label)) {
      map.set(label, NHI_SERVICE_ACCOUNT_COLOR);
    } else {
      map.set(label, CHART_SERIES_COLORS[paletteIdx % CHART_SERIES_COLORS.length]);
      paletteIdx++;
    }
  }
  return map;
}
