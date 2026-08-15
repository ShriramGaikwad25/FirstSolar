import type { LucideIcon } from "lucide-react";
import { Shield, User } from "lucide-react";

export const CONDITION_RULES_URL = "/api/lookup/condition-rules";

/** Styling for condition field chips (list + detail views). */
export function getConditionFieldPillStyle(
  field: string,
  index: number,
): { Icon: LucideIcon; pill: string; icon: string } {
  const key = field.toLowerCase();
  if (
    key.includes("user") ||
    key.includes("department") ||
    key.includes("owner") ||
    key.includes("usr")
  ) {
    return {
      Icon: User,
      pill: "border border-sky-100 bg-sky-50 text-sky-800",
      icon: "text-sky-600",
    };
  }
  if (
    key.includes("risk") ||
    key.includes("catalog") ||
    key.includes("item")
  ) {
    return {
      Icon: Shield,
      pill: "border border-emerald-100 bg-emerald-50 text-emerald-800",
      icon: "text-emerald-600",
    };
  }
  if (index % 2 === 0) {
    return {
      Icon: User,
      pill: "border border-sky-100 bg-sky-50 text-sky-800",
      icon: "text-sky-600",
    };
  }
  return {
    Icon: Shield,
    pill: "border border-emerald-100 bg-emerald-50 text-emerald-800",
    icon: "text-emerald-600",
  };
}

export interface ConditionRuleMapping {
  id: number;
  conditionValue: string;
  approverId: string;
  approverName: string;
  reviewerId: string;
  reviewerName: string;
  isActive: boolean;
}

export interface ConditionSpec {
  fields: string[];
  separator: string;
  nullHandling: string;
  placeholder: string | null;
  caseTransform: string;
}

export interface ConditionRule {
  id: number;
  name: string;
  description: string;
  condition: ConditionSpec;
  priority: number;
  isActive: boolean;
  mappings: ConditionRuleMapping[];
  createdAt: string;
  updatedAt: string;
}

export interface ConditionRulesApiResponse {
  content?: ConditionRule[];
  totalElements?: number;
  error?: string;
  message?: string;
}

export function formatConditionRuleDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export async function fetchConditionRulesFromApi(): Promise<{
  rules: ConditionRule[];
  totalElements: number;
}> {
  const res = await fetch(CONDITION_RULES_URL, { credentials: "include" });
  const data = (await res.json()) as ConditionRulesApiResponse;
  if (!res.ok) {
    const msg =
      data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  const rules = Array.isArray(data.content) ? data.content : [];
  const totalElements =
    typeof data.totalElements === "number" ? data.totalElements : rules.length;
  return { rules, totalElements };
}

/** Payload for POST to Keyforge conditionRules (create). */
export interface CreateConditionRulePayload {
  name: string;
  description: string;
  condition: {
    fields: string[];
    separator: string;
  };
  priority: number;
  /** Always empty when creating from this UI; API expects the key present. */
  mappings: ConditionRuleMapping[];
}

export async function createConditionRule(
  payload: CreateConditionRulePayload,
): Promise<unknown> {
  const res = await fetch(CONDITION_RULES_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    const msg =
      data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** Full rule body for PUT .../conditionRules/{id} (preserves mappings, isActive, condition extras). */
export type UpdateConditionRulePayload = Omit<
  ConditionRule,
  "createdAt" | "updatedAt"
>;

export async function updateConditionRule(
  id: number,
  payload: UpdateConditionRulePayload,
): Promise<unknown> {
  const res = await fetch(`${CONDITION_RULES_URL}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    const msg =
      data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
