import type {
  PolicyListStatement,
  PolicyOptimizationGrant,
  PolicyScopeCompartment,
  PolicyScopeDefinedTag,
  PolicyScopeFreeformTag,
  PolicyScopeResource,
  PolicyScopeSubject,
  PolicyScopeView,
} from "@/types/oci-policy";

const EMPTY_SCOPE_VIEW: PolicyScopeView = {
  subject: null,
  verb: null,
  resource: null,
  coverage: null,
  groupsInScope: [],
  compartmentsInScope: [],
  resourcesInScope: [],
  resourceCount: null,
  notes: null,
  residualConstraints: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getField(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const match = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match !== undefined && record[match] !== undefined) return record[match];
  }
  return undefined;
}

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getField(record, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  return readOptionalString(record, ...keys) ?? "—";
}

function normalizeRef(value: string | undefined): string {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed) return "";
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex >= 0) {
    return trimmed.slice(hashIndex + 1);
  }
  return trimmed.replace(/^#/, "");
}

function refVariants(value: string | undefined): string[] {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return [];
  const normalized = normalizeRef(trimmed);
  const variants = new Set<string>([trimmed.toLowerCase(), normalized]);
  if (normalized && /^\d+$/.test(normalized)) {
    variants.add(`#${normalized}`);
  }
  return [...variants];
}

function hasScopeFields(record: Record<string, unknown>): boolean {
  return Boolean(
    getField(record, "subject", "subjects", "subjectKind", "subjectName") ??
      getField(record, "groupsInScope", "groups_in_scope", "groups") ??
      getField(record, "resourcesInScope", "resources_in_scope", "resources") ??
      getField(record, "notes", "note")
  );
}

function parseDefinedTags(value: unknown): PolicyScopeDefinedTag[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) return [];
      const namespace = readString(item, "namespace", "tagNamespace", "ns");
      const key = readString(item, "key", "tagKey");
      const tagValue = readString(item, "value", "tagValue", "val");
      if (namespace === "—" && key === "—" && tagValue === "—") return [];
      return [{ namespace, key, value: tagValue }];
    });
  }

  if (!isRecord(value)) return [];

  const rows: PolicyScopeDefinedTag[] = [];
  for (const [namespace, tagMap] of Object.entries(value)) {
    if (!isRecord(tagMap)) continue;
    for (const [key, tagValue] of Object.entries(tagMap)) {
      rows.push({
        namespace,
        key,
        value:
          tagValue == null
            ? "—"
            : typeof tagValue === "string"
              ? tagValue
              : JSON.stringify(tagValue),
      });
    }
  }
  return rows;
}

function parseFreeformTags(value: unknown): PolicyScopeFreeformTag[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) return [];
      const key = readString(item, "key", "tagKey", "name");
      const tagValue = readString(item, "value", "tagValue", "val");
      if (key === "—" && tagValue === "—") return [];
      return [{ key, value: tagValue }];
    });
  }

  if (!isRecord(value)) return [];

  const rows: PolicyScopeFreeformTag[] = [];
  for (const [key, tagValue] of Object.entries(value)) {
    rows.push({
      key,
      value:
        tagValue == null
          ? "—"
          : typeof tagValue === "string"
            ? tagValue
            : JSON.stringify(tagValue),
    });
  }
  return rows;
}

function parseSubject(record: Record<string, unknown>): PolicyScopeSubject | null {
  const subjectValue = getField(record, "subject", "subjects");
  const subjectRecord = Array.isArray(subjectValue)
    ? (subjectValue.find(isRecord) ?? null)
    : isRecord(subjectValue)
      ? subjectValue
      : null;

  if (subjectRecord) {
    return {
      kind: readString(subjectRecord, "kind", "type", "subjectKind"),
      name: readString(subjectRecord, "name", "displayName", "subjectName"),
    };
  }

  const kind = readOptionalString(record, "subjectKind", "kind", "type");
  const name = readOptionalString(record, "subjectName", "name", "displayName");
  if (!kind && !name) return null;
  return { kind: kind ?? "—", name: name ?? "—" };
}

function parseGroupsInScope(record: Record<string, unknown>): string[] {
  const raw = getField(record, "groupsInScope", "groups_in_scope", "groups");
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!isRecord(item)) return "";
      const nestedGroup = getField(item, "group");
      if (isRecord(nestedGroup)) {
        return (
          readOptionalString(nestedGroup, "name", "groupName", "displayName") ??
          readOptionalString(item, "name", "groupName", "displayName") ??
          ""
        );
      }
      return readOptionalString(item, "name", "groupName", "displayName") ?? "";
    })
    .filter(Boolean);
}

function parseScopeResourceItem(
  item: Record<string, unknown>,
  compartmentNameFallback: string
): PolicyScopeResource {
  const compartmentValue = getField(item, "compartment", "compartmentName", "compartment_name");
  const compartmentName =
    typeof compartmentValue === "string"
      ? compartmentValue
      : isRecord(compartmentValue)
        ? readString(compartmentValue, "name", "compartmentName", "displayName")
        : compartmentNameFallback || readString(item, "compartmentName", "compartment_name");

  return {
    compartmentName: compartmentName || "—",
    displayName: readString(item, "displayName", "display_name", "name", "identifier"),
    resourceType: readString(item, "resourceType", "resource_type", "type"),
    lifecycleState: readString(item, "lifecycleState", "lifecycle_state", "state"),
    definedTags: parseDefinedTags(getField(item, "definedTags", "defined_tags")),
    freeformTags: parseFreeformTags(
      getField(item, "freeformTags", "freeform_tags", "freeform", "freeFormTags")
    ),
  };
}

function parseCompartmentsInScope(record: Record<string, unknown>): PolicyScopeCompartment[] {
  const raw = getField(record, "resourcesInScope", "resources_in_scope", "resources");
  if (!isRecord(raw)) return [];

  const compartments = getField(raw, "compartments");
  if (!Array.isArray(compartments)) return [];

  return compartments.flatMap((compartment) => {
    if (!isRecord(compartment)) return [];
    const compartmentName = readCompartmentName(compartment);
    const countValue = getField(compartment, "count", "resourceCount", "resource_count");
    const count =
      typeof countValue === "number" && Number.isFinite(countValue)
        ? countValue
        : Array.isArray(getField(compartment, "resources"))
          ? (getField(compartment, "resources") as unknown[]).length
          : 0;

    const compartmentResources = getField(compartment, "resources");
    const resources = Array.isArray(compartmentResources)
      ? compartmentResources
          .filter(isRecord)
          .map((item) => parseScopeResourceItem(item, compartmentName))
      : [];

    return [{ compartmentName, count, resources }];
  });
}

function parseResourcesInScope(record: Record<string, unknown>): PolicyScopeResource[] {
  return parseCompartmentsInScope(record).flatMap((compartment) => compartment.resources);
}

function readCompartmentName(compartment: Record<string, unknown>): string {
  const explicit = readOptionalString(
    compartment,
    "compartmentName",
    "compartment_name",
    "name",
    "displayName"
  );
  if (explicit) return explicit;

  const compartmentId = readOptionalString(compartment, "compartmentId", "compartment_id");
  if (compartmentId?.includes(".tenancy.")) return "tenancy";

  return compartmentId ?? "—";
}

function parseNotes(record: Record<string, unknown>): string | null {
  const raw = getField(record, "notes", "note", "comments");
  if (Array.isArray(raw)) {
    const lines = raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : null;
  }

  return readOptionalString(record, "notes", "note", "comments");
}

function parseResidualConstraints(record: Record<string, unknown>): string[] {
  const raw = getField(record, "residualConstraints", "residual_constraints");
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];

    const variable = readOptionalString(item, "variable");
    const operator = readOptionalString(item, "operator");
    const listValue = getField(item, "values", "value");
    const values = Array.isArray(listValue)
      ? listValue
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean)
      : typeof listValue === "string" && listValue.trim()
        ? [listValue.trim()]
        : [];

    if (variable && operator) {
      return [`${variable} ${operator} ${values.length > 0 ? values.join(", ") : "—"}`];
    }

    return values;
  });
}

function readResourceCount(record: Record<string, unknown>): number | null {
  const raw = getField(record, "resourcesInScope", "resources_in_scope", "resources");
  if (isRecord(raw)) {
    const count = getField(raw, "resourceCount", "resource_count", "count");
    if (typeof count === "number" && Number.isFinite(count)) return count;
  }
  const topLevel = getField(record, "resourceCount", "resource_count");
  if (typeof topLevel === "number" && Number.isFinite(topLevel)) return topLevel;
  return null;
}

function parseScopeMeta(record: Record<string, unknown>): {
  verb: string | null;
  resource: string | null;
  coverage: string | null;
} {
  return {
    verb: readOptionalString(record, "verb", "action") ?? null,
    resource: readOptionalString(record, "resource", "resourceType", "resource_type") ?? null,
    coverage: readOptionalString(record, "coverage") ?? null,
  };
}

function pickStatementRecordByIndex(
  scopes: unknown,
  statementIndex: number,
  policyName?: string
): Record<string, unknown> | undefined {
  if (!isRecord(scopes)) return undefined;

  const statements = getField(scopes, "statements", "statementScopes", "statement_scopes");
  if (!Array.isArray(statements) || statements.length === 0) return undefined;

  const policyLower = policyName?.trim().toLowerCase();
  const candidates = statements.filter((item): item is Record<string, unknown> => {
    if (!isRecord(item)) return false;
    if (!policyLower) return true;
    const itemPolicy = readOptionalString(item, "policyName", "policy_name")?.toLowerCase();
    return !itemPolicy || itemPolicy === policyLower;
  });

  const byPosition = candidates[statementIndex];
  if (isRecord(byPosition)) {
    const positionIndex = readStatementIndex(byPosition);
    if (positionIndex == null || positionIndex === statementIndex) {
      return normalizeScopeRecord(byPosition);
    }
  }

  const found = candidates.find((item) => readStatementIndex(item) === statementIndex);
  return found ? normalizeScopeRecord(found) : undefined;
}

function parseScopeView(record: Record<string, unknown>): PolicyScopeView {
  const compartmentsInScope = parseCompartmentsInScope(record);
  const resourcesInScope = compartmentsInScope.flatMap((compartment) => compartment.resources);
  const compartmentTotal = compartmentsInScope.reduce((sum, compartment) => sum + compartment.count, 0);
  const resourceCount =
    readResourceCount(record) ??
    (compartmentTotal > 0 ? compartmentTotal : resourcesInScope.length > 0 ? resourcesInScope.length : null);
  const meta = parseScopeMeta(record);

  return {
    subject: parseSubject(record),
    verb: meta.verb,
    resource: meta.resource,
    coverage: meta.coverage,
    groupsInScope: parseGroupsInScope(record),
    compartmentsInScope,
    resourcesInScope,
    resourceCount,
    notes: parseNotes(record),
    residualConstraints: parseResidualConstraints(record),
  };
}

function normalizeScopeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const nested = getField(record, "scope", "scopeDetails", "scope_details", "details", "data");
  if (isRecord(nested) && hasScopeFields(nested)) {
    const merged = { ...nested };
    const ref = readOptionalString(record, "ref", "statementRef", "statement_ref", "index");
    if (ref && !getField(merged, "ref", "statementRef", "statement_ref", "index")) {
      merged.ref = ref;
    }
    const statementId = readOptionalString(record, "statementId", "statement_id", "id");
    if (statementId && !getField(merged, "statementId", "statement_id", "id")) {
      merged.statementId = statementId;
    }
    const statementIndex = getField(record, "statementIndex", "statement_index");
    if (
      statementIndex != null &&
      getField(merged, "index", "statementIndex", "statement_index") == null
    ) {
      merged.statementIndex = statementIndex;
    }
    const policyName = readOptionalString(record, "policyName", "policy_name");
    if (policyName && !getField(merged, "policyName", "policy_name")) {
      merged.policyName = policyName;
    }
    return merged;
  }
  return record;
}

function recordsFromObjectMap(value: Record<string, unknown>): Record<string, unknown>[] {
  const entries = Object.entries(value).filter(([, item]) => isRecord(item));
  if (entries.length === 0) return [];

  const records = entries.map(([key, item]) => {
    const record = normalizeScopeRecord(item);
    if (
      !readOptionalString(record, "ref", "statementRef", "statement_ref", "index", "label")
    ) {
      return { ...record, ref: key.startsWith("#") ? key : `#${key}` };
    }
    return record;
  });

  return records.some((record) => hasScopeFields(record)) ? records : [];
}

function extractScopeRecords(scopes: unknown, policyName?: string): Record<string, unknown>[] {
  if (!scopes) return [];

  if (Array.isArray(scopes)) {
    return scopes.filter(isRecord).map(normalizeScopeRecord);
  }

  if (!isRecord(scopes)) return [];

  if (policyName) {
    const policyEntry = getField(scopes, policyName);
    if (policyEntry) {
      const nested = extractScopeRecords(policyEntry, policyName);
      if (nested.length > 0) return nested;
    }
  }

  const statementsList = getField(scopes, "statements", "statementScopes", "statement_scopes");
  if (Array.isArray(statementsList) && statementsList.length > 0) {
    return statementsList.filter(isRecord).map(normalizeScopeRecord);
  }

  if (hasScopeFields(scopes)) {
    return [normalizeScopeRecord(scopes)];
  }

  const mapRecords = recordsFromObjectMap(scopes);
  if (mapRecords.length > 0) return mapRecords;

  for (const key of [
    "statementScopes",
    "statement_scopes",
    "scopes",
    "scope",
    "scopeDetails",
    "items",
    "data",
    "result",
    "payload",
    "results",
    "rows",
  ]) {
    const value = getField(scopes, key);
    if (Array.isArray(value)) {
      const records = value.filter(isRecord).map(normalizeScopeRecord);
      if (records.length > 0) return records;
    }
    if (isRecord(value)) {
      const mapFromValue = recordsFromObjectMap(value);
      if (mapFromValue.length > 0) return mapFromValue;
      const nested = extractScopeRecords(value, policyName);
      if (nested.length > 0) return nested;
    }
  }

  const objectValues = Object.values(scopes).filter(isRecord).map(normalizeScopeRecord);
  if (objectValues.length > 0 && objectValues.every((record) => hasScopeFields(record))) {
    return objectValues;
  }

  if (isRecord(scopes) && Array.isArray(getField(scopes, "statements"))) {
    return [];
  }

  return hasScopeFields(scopes) ? [normalizeScopeRecord(scopes)] : [];
}

function readStatementIndex(record: Record<string, unknown>): number | undefined {
  const indexValue = getField(record, "statementIndex", "statement_index", "index");
  if (typeof indexValue === "number" && Number.isFinite(indexValue)) return indexValue;
  if (typeof indexValue === "string" && /^\d+$/.test(indexValue.trim())) {
    return Number(indexValue.trim());
  }

  const ref = readOptionalString(record, "ref", "statementRef", "statement_ref");
  if (ref) {
    const normalized = normalizeRef(ref);
    if (/^\d+$/.test(normalized)) return Number(normalized);
  }

  return undefined;
}

/** 0-based index used to match scopes API `statementIndex` / `PolicyName#N` refs. */
export function resolveScopesStatementIndex(
  statement: PolicyListStatement,
  arrayIndex: number,
  policyName?: string
): number {
  const ref = statement.ref?.trim();
  if (ref) {
    const normalized = normalizeRef(
      ref.includes("#") ? ref : `${policyName?.trim() ?? ""}#${ref.replace(/^#/, "")}`
    );
    if (/^\d+$/.test(normalized)) return Number(normalized);
  }
  return arrayIndex;
}

export function buildScopesStatementRef(policyName: string, statementIndex: number): string {
  return `${policyName.trim()}#${statementIndex}`;
}

function readStatementTextFromScopeRecord(record: Record<string, unknown>): string {
  const textKeys = [
    "raw",
    "rawStatement",
    "raw_statement",
    "text",
    "statement",
    "statement_text",
    "statementText",
    "policyStatement",
    "iamStatement",
    "fullText",
    "content",
    "body",
    "value",
  ] as const;

  const direct = readOptionalString(record, ...textKeys);
  if (direct) return direct;

  const nested = getField(record, "scope", "scopeDetails", "scope_details", "details", "data");
  if (isRecord(nested)) {
    return readOptionalString(nested, ...textKeys) ?? "";
  }

  return "";
}

function readGrantRefFromScopeRecord(
  record: Record<string, unknown>,
  policyName: string,
  fallbackIndex: number
): string {
  const explicit = readOptionalString(record, "ref", "statementRef", "statement_ref");
  if (explicit?.includes("#")) return explicit;

  const index = readStatementIndex(record) ?? fallbackIndex;
  if (explicit) {
    const normalized = normalizeRef(explicit);
    if (/^\d+$/.test(normalized)) {
      return buildScopesStatementRef(policyName, Number(normalized));
    }
    return explicit;
  }

  return buildScopesStatementRef(policyName, index);
}

export function extractPolicyGrantsFromScopesPayload(
  payload: unknown,
  policyName: string
): PolicyOptimizationGrant[] {
  const scopes = unwrapScopesEnvelope(payload);
  if (!scopes) return [];

  const statements = isRecord(scopes)
    ? getField(scopes, "statements", "statementScopes", "statement_scopes")
    : null;

  const records =
    Array.isArray(statements) && statements.length > 0
      ? statements.filter(isRecord)
      : extractScopeRecords(scopes, policyName);

  const trimmedPolicy = policyName.trim();
  const policyLower = trimmedPolicy.toLowerCase();
  const grants: PolicyOptimizationGrant[] = [];

  records.forEach((record, index) => {
    const recordPolicy = readOptionalString(record, "policyName", "policy_name");
    if (recordPolicy && recordPolicy.toLowerCase() !== policyLower) return;

    const raw = readStatementTextFromScopeRecord(record);
    if (!raw) return;

    grants.push({
      policyName: recordPolicy ?? trimmedPolicy,
      ref: readGrantRefFromScopeRecord(record, trimmedPolicy, index),
      raw,
    });
  });

  return grants;
}

function matchesPolicyName(record: Record<string, unknown>, policyName?: string): boolean {
  if (!policyName?.trim()) return true;
  const recordPolicy = readOptionalString(record, "policyName", "policy_name");
  if (!recordPolicy) return true;
  return recordPolicy.toLowerCase() === policyName.trim().toLowerCase();
}

function matchesStatement(
  record: Record<string, unknown>,
  options: {
    policyName?: string;
    statementRef?: string;
    statementId?: string;
    statementIndex?: number;
  }
): boolean {
  if (!matchesPolicyName(record, options.policyName)) return false;

  const targetIndex = options.statementIndex;
  if (targetIndex != null) {
    const recordIndex = readStatementIndex(record);
    if (recordIndex != null) return recordIndex === targetIndex;
  }

  const targetRefVariants = refVariants(options.statementRef);
  if (options.policyName && targetIndex != null) {
    targetRefVariants.push(...refVariants(`${options.policyName}#${targetIndex}`));
  }
  const targetRefSet = new Set(targetRefVariants.map(normalizeRef).filter(Boolean));
  const targetId = (options.statementId ?? "").trim().toLowerCase();

  const candidates = [
    readOptionalString(record, "ref", "statementRef", "statement_ref"),
    readOptionalString(record, "statementId", "statement_id", "id"),
    readOptionalString(record, "index", "statementIndex", "statement_index"),
  ].filter(Boolean) as string[];

  if (targetRefSet.size > 0) {
    if (
      candidates.some((candidate) => {
        const variants = refVariants(candidate);
        return variants.some((variant) => targetRefSet.has(normalizeRef(variant)));
      })
    ) {
      return true;
    }
  }

  if (targetId && candidates.some((candidate) => candidate.toLowerCase() === targetId)) {
    return true;
  }

  if (targetIndex != null) {
    if (candidates.some((candidate) => Number(candidate) === targetIndex)) return true;
    if (candidates.some((candidate) => normalizeRef(candidate) === String(targetIndex))) {
      return true;
    }
  }

  return false;
}

function findMatchingStatementRecord(
  records: Record<string, unknown>[],
  options: ResolvePolicyScopeOptions
): Record<string, unknown> | undefined {
  const policyFiltered = options.policyName
    ? records.filter((record) => matchesPolicyName(record, options.policyName))
    : records;
  const candidates = policyFiltered.length > 0 ? policyFiltered : records;

  if (options.statementIndex != null) {
    const byIndex = candidates.find((record) => {
      const recordIndex = readStatementIndex(record);
      return recordIndex != null && recordIndex === options.statementIndex;
    });
    if (byIndex) return byIndex;

    const expectedRef = options.policyName
      ? buildScopesStatementRef(options.policyName, options.statementIndex).toLowerCase()
      : null;
    if (expectedRef) {
      const byRef = candidates.find((record) => {
        const ref = readOptionalString(record, "ref", "statementRef", "statement_ref");
        return ref?.toLowerCase() === expectedRef;
      });
      if (byRef) return byRef;
    }

    const atPosition = candidates[options.statementIndex];
    if (atPosition) {
      const positionIndex = readStatementIndex(atPosition);
      if (positionIndex == null || positionIndex === options.statementIndex) {
        return atPosition;
      }
    }
  }

  return candidates.find((record) =>
    matchesStatement(record, {
      policyName: options.policyName,
      statementRef: options.statementRef,
      statementId: options.statementId,
      statementIndex: options.statementIndex,
    })
  );
}

export function filterPolicyScopesPayload(
  scopes: unknown,
  options: { policyName?: string; statementIndex?: number }
): unknown {
  if (!isRecord(scopes) || options.statementIndex == null) return scopes;

  const statements = getField(scopes, "statements");
  if (!Array.isArray(statements)) return scopes;

  const policyName = options.policyName?.trim().toLowerCase();
  const targetIndex = options.statementIndex;

  const filtered = statements.filter((item) => {
    if (!isRecord(item)) return false;
    if (policyName) {
      const itemPolicy = readOptionalString(item, "policyName", "policy_name")?.toLowerCase();
      if (itemPolicy && itemPolicy !== policyName) return false;
    }
    const itemIndex = readStatementIndex(item);
    if (itemIndex != null) return itemIndex === targetIndex;

    const ref = readOptionalString(item, "ref", "statementRef", "statement_ref");
    if (ref && policyName) {
      return normalizeRef(ref) === String(targetIndex);
    }
    return false;
  });

  if (filtered.length === 0) {
    return { ...scopes, statements: [], statementCount: 0 };
  }

  return {
    ...scopes,
    statements: filtered,
    statementCount: filtered.length,
  };
}

function isEmptyScopeView(view: PolicyScopeView): boolean {
  return (
    !view.subject &&
    view.groupsInScope.length === 0 &&
    view.compartmentsInScope.length === 0 &&
    view.resourcesInScope.length === 0 &&
    view.resourceCount == null &&
    !view.notes?.trim() &&
    view.residualConstraints.length === 0
  );
}

export function buildScopeViewFromStatement(statement: PolicyListStatement): PolicyScopeView {
  const primarySubject = statement.subjects?.[0];
  let subject = primarySubject
    ? { kind: primarySubject.kind || "—", name: primarySubject.name || "—" }
    : null;

  let verb = statement.verb?.trim() || "";
  let resource = statement.resource?.trim() || "";
  let compartmentName = statement.compartmentName?.trim() || "";
  let condition = statement.condition?.trim() || "";

  if (!subject || (!verb && !resource)) {
    const parsed = parseOciPolicyStatementText(statement.text);
    subject = subject ?? parsed.subject;
    verb = verb || parsed.verb;
    resource = resource || parsed.resource;
    compartmentName = compartmentName || parsed.compartmentName;
    condition = condition || parsed.condition;
  }

  const resourcesInScope: PolicyScopeResource[] = [];
  if (resource) {
    resourcesInScope.push({
      compartmentName: compartmentName || "—",
      displayName: resource,
      resourceType: resource,
      lifecycleState: "—",
      definedTags: [],
      freeformTags: [],
    });
  }

  return {
    subject,
    verb: verb || null,
    resource: resource || null,
    coverage: null,
    groupsInScope: [],
    compartmentsInScope: resourcesInScope.length
      ? [{ compartmentName: compartmentName || "—", count: resourcesInScope.length, resources: resourcesInScope }]
      : [],
    resourcesInScope,
    resourceCount: resourcesInScope.length > 0 ? resourcesInScope.length : null,
    notes: condition || null,
    residualConstraints: [],
  };
}

function parseOciPolicyStatementText(text: string): {
  subject: PolicyScopeSubject | null;
  verb: string;
  resource: string;
  compartmentName: string;
  condition: string;
} {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(allow|endorse|admit)\s+(\S+)\s+(.+?)\s+to\s+(\S+)\s+(.+?)(?:\s+in\s+(tenancy|compartment)\s+(.+?))?(?:\s+where\s+(.+))?$/i
  );

  if (!match) {
    return { subject: null, verb: "", resource: "", compartmentName: "", condition: "" };
  }

  const [, , subjectKind, subjectName, verb, resource, scopeKind, scopeName, whereClause] = match;
  const kind = subjectKind.toUpperCase().replace(/-/g, "_");
  const compartment =
    scopeKind?.toLowerCase() === "tenancy"
      ? "tenancy"
      : scopeName?.trim() || scopeKind?.trim() || "";

  return {
    subject: {
      kind,
      name: subjectName.trim(),
    },
    verb: verb.trim(),
    resource: resource.trim(),
    compartmentName: compartment,
    condition: whereClause?.trim() || "",
  };
}

export function mergeScopeViews(primary: PolicyScopeView, fallback: PolicyScopeView): PolicyScopeView {
  return {
    subject: primary.subject ?? fallback.subject,
    verb: primary.verb ?? fallback.verb,
    resource: primary.resource ?? fallback.resource,
    coverage: primary.coverage ?? fallback.coverage,
    groupsInScope:
      primary.groupsInScope.length > 0 ? primary.groupsInScope : fallback.groupsInScope,
    compartmentsInScope:
      primary.compartmentsInScope.length > 0
        ? primary.compartmentsInScope
        : fallback.compartmentsInScope,
    resourcesInScope:
      primary.resourcesInScope.length > 0 ? primary.resourcesInScope : fallback.resourcesInScope,
    resourceCount: primary.resourceCount ?? fallback.resourceCount,
    notes: primary.notes?.trim() ? primary.notes : fallback.notes,
    residualConstraints:
      primary.residualConstraints.length > 0
        ? primary.residualConstraints
        : fallback.residualConstraints,
  };
}

export type ResolvePolicyScopeOptions = {
  policyName?: string;
  statementRef?: string;
  statementId?: string;
  statementIndex?: number;
  statement?: PolicyListStatement;
};

export function resolvePolicyScopeView(
  scopes: unknown,
  options?: ResolvePolicyScopeOptions
): PolicyScopeView {
  const fallback = options?.statement
    ? buildScopeViewFromStatement(options.statement)
    : EMPTY_SCOPE_VIEW;
  const hasStatementSelector =
    options?.statementIndex != null ||
    Boolean(options?.statementRef?.trim()) ||
    Boolean(options?.statementId?.trim());

  if (options?.statementIndex != null) {
    const direct = pickStatementRecordByIndex(scopes, options.statementIndex, options.policyName);
    if (direct) {
      return parseScopeView(direct);
    }
  }

  const records = extractScopeRecords(scopes, options?.policyName);

  if (records.length === 0) {
    if (isRecord(scopes) && hasScopeFields(scopes) && !hasStatementSelector) {
      const parsed = parseScopeView(scopes);
      return isEmptyScopeView(parsed) ? mergeScopeViews(parsed, fallback) : parsed;
    }
    return fallback;
  }

  if (options && hasStatementSelector) {
    const matched = findMatchingStatementRecord(records, options);
    if (matched) {
      return parseScopeView(matched);
    }
    return fallback;
  }

  if (records.length === 1) {
    const parsed = parseScopeView(records[0]);
    return isEmptyScopeView(parsed) ? mergeScopeViews(parsed, fallback) : parsed;
  }

  return fallback;
}

function unwrapScopesEnvelope(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  let current: Record<string, unknown> = payload;
  for (let depth = 0; depth < 4; depth += 1) {
    const nested = getField(current, "scopes", "scope", "data", "result", "payload");
    if (!isRecord(nested) || nested === current) break;
    current = nested;
  }

  return current;
}

export function sliceScopesPayloadToStatement(
  payload: unknown,
  statementIndex: number,
  policyName?: string
): unknown {
  if (!isRecord(payload)) return payload;

  const envelope = isRecord(getField(payload, "scopes", "scope", "data")) ? payload : null;
  const scopes = unwrapScopesEnvelope(payload);
  if (!isRecord(scopes)) return payload;

  const statements = getField(scopes, "statements", "statementScopes", "statement_scopes");
  if (!Array.isArray(statements) || statements.length === 0) return payload;

  const policyLower = policyName?.trim().toLowerCase();
  let matched = statements[statementIndex];
  if (!isRecord(matched)) {
    matched = statements.find((item) => {
      if (!isRecord(item)) return false;
      if (policyLower) {
        const itemPolicy = readOptionalString(item, "policyName", "policy_name")?.toLowerCase();
        if (itemPolicy && itemPolicy !== policyLower) return false;
      }
      return readStatementIndex(item) === statementIndex;
    });
  }

  if (!isRecord(matched)) {
    const emptyScopes = { ...scopes, statements: [], statementCount: 0 };
    return envelope ? { ...envelope, scopes: emptyScopes } : emptyScopes;
  }

  const slicedScopes = { ...scopes, statements: [matched], statementCount: 1 };
  return envelope ? { ...envelope, scopes: slicedScopes } : slicedScopes;
}

export function resolvePolicyScopeViewFromPayload(
  payload: unknown,
  options?: ResolvePolicyScopeOptions
): PolicyScopeView {
  if (!payload) {
    return options?.statement ? buildScopeViewFromStatement(options.statement) : EMPTY_SCOPE_VIEW;
  }

  const resolvedOptions: ResolvePolicyScopeOptions = { ...options };
  if (isRecord(payload) && resolvedOptions.statementIndex == null) {
    const payloadIndex = readStatementIndex(payload);
    if (payloadIndex != null) resolvedOptions.statementIndex = payloadIndex;
  }

  if (!resolvedOptions.statementRef && resolvedOptions.policyName && resolvedOptions.statementIndex != null) {
    resolvedOptions.statementRef = buildScopesStatementRef(
      resolvedOptions.policyName,
      resolvedOptions.statementIndex
    );
  }

  const scopedPayload =
    resolvedOptions.statementIndex != null
      ? sliceScopesPayloadToStatement(
          payload,
          resolvedOptions.statementIndex,
          resolvedOptions.policyName
        )
      : payload;

  if (isRecord(scopedPayload)) {
    const unwrapped = unwrapScopesEnvelope(scopedPayload);
    return resolvePolicyScopeView(unwrapped, resolvedOptions);
  }

  return resolvePolicyScopeView(scopedPayload, resolvedOptions);
}
