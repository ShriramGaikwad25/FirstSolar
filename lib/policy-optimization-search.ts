import type {
  PolicyOptimizationGroup,
  PolicyOptimizationItem,
} from "@/types/oci-policy";

/** Lowercase, unify separators, collapse whitespace for fuzzy matching. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_\-./:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function searchTokens(rawQuery: string): string[] {
  return normalizeSearchText(rawQuery).split(" ").filter(Boolean);
}

function rowSearchFields(row: PolicyOptimizationItem): string[] {
  const grantFields =
    row.redundantGrants?.flatMap((grant) => [grant.ref, grant.policyName, grant.raw]) ?? [];
  const coveredFields =
    row.coveredBy?.flatMap((grant) => [grant.ref, grant.policyName, grant.raw]) ?? [];

  return [
    row.policyName,
    row.statement,
    row.groupName,
    row.compartment,
    row.compartmentOcid,
    row.action,
    row.resource,
    row.optimizationType,
    row.severity,
    row.rawStatement,
    row.reason,
    row.recommendation,
    ...grantFields,
    ...coveredFields,
  ].map(normalizeSearchText);
}

function tokenMatchesRow(token: string, fields: string[], haystack: string): boolean {
  const compactToken = compactSearchText(token);
  if (!compactToken) return true;

  if (haystack.includes(token)) return true;
  if (compactHaystackIncludes(haystack, compactToken)) return true;

  return fields.some((field) => {
    if (!field) return false;
    if (field.includes(token)) return true;
    return compactHaystackIncludes(field, compactToken);
  });
}

function compactHaystackIncludes(haystack: string, compactToken: string): boolean {
  const compactHaystack = haystack.replace(/\s+/g, "");
  return compactHaystack.includes(compactToken);
}

/** All query words must match somewhere on the row (AND semantics). */
export function rowMatchesPolicyOptimizationSearch(
  row: PolicyOptimizationItem,
  rawQuery: string
): boolean {
  const tokens = searchTokens(rawQuery);
  if (tokens.length === 0) return true;

  const fields = rowSearchFields(row);
  const haystack = fields.filter(Boolean).join(" ");

  return tokens.every((token) => tokenMatchesRow(token, fields, haystack));
}

export function filterPolicyOptimizationRows(
  rows: PolicyOptimizationItem[],
  rawQuery: string
): PolicyOptimizationItem[] {
  const tokens = searchTokens(rawQuery);
  if (tokens.length === 0) return rows;
  return rows.filter((row) => rowMatchesPolicyOptimizationSearch(row, rawQuery));
}

function optimizationGroupKey(row: PolicyOptimizationItem): string {
  return row.optimizationType;
}

export function groupPolicyOptimizationRows(
  rows: PolicyOptimizationItem[]
): PolicyOptimizationGroup[] {
  const map = new Map<string, PolicyOptimizationGroup>();

  for (const row of rows) {
    const key = optimizationGroupKey(row);
    const existing = map.get(key);
    if (existing) {
      existing.statements.push(row);
      continue;
    }

    map.set(key, {
      key,
      optimizationType: row.optimizationType,
      groupName: "",
      compartment: "",
      statements: [row],
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.optimizationType.localeCompare(b.optimizationType)
  );
}
