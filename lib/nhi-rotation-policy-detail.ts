import { coerceRowObject, extractResultRows } from "@/lib/nhi-dashboard";

export const ROTATION_POLICY_BY_ID_QUERY =
  "SELECT * FROM kf_nhi_rotation_policy WHERE policy_id = ?::uuid";

export function extractRotationPolicyDetailRow(response: unknown): Record<string, unknown> | null {
  const raw = extractResultRows(response);
  if (raw.length === 0) return null;
  const first = raw[0];
  return coerceRowObject(first) ?? (first as Record<string, unknown>);
}
