export const FAMILIES: Record<string, string[]> = {
  "all-resources": ["every resource-type in the tenancy"],
  "virtual-network-family": [
    "vcns",
    "subnets",
    "route-tables",
    "security-lists",
    "network-security-groups",
    "internet-gateways",
    "nat-gateways",
    "service-gateways",
    "local-peering-gateways",
    "dhcp-options",
    "public-ips",
  ],
  "instance-family": [
    "instances",
    "instance-images",
    "volume-attachments",
    "console-histories",
    "instance-console-connection",
  ],
  "volume-family": [
    "volumes",
    "volume-attachments",
    "volume-backups",
    "boot-volumes",
    "boot-volume-backups",
  ],
  "object-family": ["buckets", "objects"],
  "database-family": ["db-systems", "databases", "db-nodes", "db-homes", "backups"],
};

export const INDIV = [
  "instances",
  "vcns",
  "subnets",
  "buckets",
  "objects",
  "db-systems",
  "volumes",
  "groups",
  "functions-function",
  "log-groups",
  "secret-family",
];

export const RES_OPTIONS = [...Object.keys(FAMILIES), ...INDIV];

export const RULE_ATTRS = [
  "instance.compartment.id",
  "instance.id",
  "resource.compartment.id",
  "resource.id",
  "tag.<namespace>.<key>",
  "resource.type",
];

export const COND_VARS = [
  "request.region",
  "request.operation",
  "request.permission",
  "request.networkSource.name",
  "target.resource.type",
  "target.compartment.id",
  "request.principal.type",
];

export type ScenarioId = "access" | "dyn" | "rp" | "tbac" | "xt";

export type ConditionRow = {
  id: string;
  variable: string;
  operator: "=" | "!=";
  value: string;
};

export type RuleRow = {
  id: string;
  attribute: string;
  operator: "=" | "!=";
  value: string;
};

export type ValidationMessage = {
  level: "ok" | "warn";
  html: string;
};

export type PreviewResult = {
  text: string;
  count: string | number;
  saved: string;
  savedClass: "ok" | "warn" | "red";
  countClass: "ok" | "warn" | "red";
  validation: ValidationMessage[];
};

export type AccessForm = {
  subjectType: string;
  subject: string;
  verb: string;
  resource: string;
  locType: string;
  location: string;
  conditions: ConditionRow[];
  combine: "all" | "any";
};

export type DynamicGroupForm = {
  name: string;
  compartment: string;
  combine: "ANY" | "ALL";
  rules: RuleRow[];
};

export type ResourcePrincipalForm = {
  dynamicGroup: string;
  verb: string;
  resource: string;
  locType: string;
  location: string;
  scope: "off" | "self";
};

export type TbacForm = {
  subjectType: string;
  subject: string;
  verb: string;
  resource: string;
  tagNamespace: string;
  tagKey: string;
  tagValue: string;
  replacedCount: string;
};

export type CrossTenancyForm = {
  role: "source" | "dest";
  alias: string;
  tenancyOcid: string;
  group: string;
  groupOcid: string;
  verb: string;
  resource: string;
  destinationCompartment: string;
};

function quoteValue(v: string): string {
  return `'${v}'`;
}

function formatConditionParts(conditions: ConditionRow[]): string[] {
  return conditions
    .map((c) => {
      const v = c.value.trim();
      if (!v) return "";
      return `${c.variable} ${c.operator} ${quoteValue(v)}`;
    })
    .filter(Boolean);
}

export function buildConditionClause(
  conditions: ConditionRow[],
  combine: "all" | "any"
): string {
  const parts = formatConditionParts(conditions);
  if (parts.length === 0) return "";
  if (parts.length === 1) return ` where ${parts[0]}`;
  return ` where ${combine} { ${parts.join(", ")} }`;
}

export function formatRuleRow(rule: RuleRow): string {
  const v = rule.value.trim();
  if (rule.attribute.startsWith("tag.")) {
    const attr =
      rule.attribute === "tag.<namespace>.<key>"
        ? "tag.Operations.Role.value"
        : rule.attribute;
    return `${attr} ${rule.operator} ${quoteValue(v || "<value>")}`;
  }
  return `${rule.attribute} ${rule.operator} ${quoteValue(v || "<value>")}`;
}

export function familyHintText(resource: string): string {
  const family = FAMILIES[resource];
  if (family) {
    const suffix = resource !== "all-resources" ? " …" : "";
    return `${resource} covers: ${family.join(", ")}${suffix}`;
  }
  return "Individual resource-type — not a family.";
}

export function buildPreview(
  scenario: ScenarioId,
  access: AccessForm,
  dynamicGroup: DynamicGroupForm,
  resourcePrincipal: ResourcePrincipalForm,
  tbac: TbacForm,
  crossTenancy: CrossTenancyForm
): PreviewResult {
  let text = "";
  let count: string | number = 1;
  let saved = "—";
  let savedClass: PreviewResult["savedClass"] = "ok";
  let countClass: PreviewResult["countClass"] = "red";
  const validation: ValidationMessage[] = [];

  if (scenario === "access") {
    const subj =
      access.subjectType === "any-user"
        ? "any-user"
        : `${access.subjectType} ${access.subject.trim() || "<name>"}`;
    const place =
      access.locType === "tenancy"
        ? "tenancy"
        : `compartment ${access.location.trim() || "<compartment>"}`;
    const where = buildConditionClause(access.conditions, access.combine);
    text = `Allow ${subj} to ${access.verb} ${access.resource} in ${place}${where}`;

    if (access.locType === "tenancy") {
      validation.push({
        level: "warn",
        html:
          "Tenancy-level statement — counts toward <b>every</b> root→leaf path. Prefer a leaf compartment where possible.",
      });
    }
    if (access.resource === "all-resources" && access.verb === "manage") {
      validation.push({
        level: "warn",
        html:
          "manage all-resources is very broad — consider scoping by resource-type or a defined tag.",
      });
    }
    validation.push({
      level: "ok",
      html: "Single statement, access-equivalent — safe to deploy as written.",
    });
  } else if (scenario === "dyn") {
    const name = dynamicGroup.name.trim();
    const comp = dynamicGroup.compartment.trim();
    const rules = dynamicGroup.rules.map(formatRuleRow).filter(Boolean);
    const body =
      rules.length <= 1
        ? rules[0] || "<rule>"
        : `${dynamicGroup.combine} { ${rules.join(", ")} }`;
    text =
      `// Dynamic group  (Identity → Dynamic Groups)\n` +
      `Name:        ${name || "<name>"}\n` +
      `Compartment: ${comp || "<compartment>"}\n` +
      `Matching rule:\n  ${body}`;
    count = `${rules.length} rule(s)`;

    if (rules.length === 0) {
      validation.push({
        level: "warn",
        html: "Add at least one matching rule or the group matches nothing.",
      });
    }
    if (dynamicGroup.combine === "ANY" && rules.length > 1) {
      validation.push({
        level: "ok",
        html: "ANY = a resource matches if it satisfies <b>any</b> rule (union).",
      });
    }
    if (dynamicGroup.combine === "ALL" && rules.length > 1) {
      validation.push({
        level: "ok",
        html: "ALL = a resource must satisfy <b>every</b> rule (intersection).",
      });
    }
    validation.push({
      level: "ok",
      html: "Membership is computed automatically — no manual members.",
    });
  } else if (scenario === "rp") {
    const dg = resourcePrincipal.dynamicGroup.trim();
    const place =
      resourcePrincipal.locType === "tenancy"
        ? "tenancy"
        : `compartment ${resourcePrincipal.location.trim() || "<compartment>"}`;
    const where =
      resourcePrincipal.scope === "self"
        ? " where request.principal.compartment.id = target.compartment.id"
        : "";
    text =
      `// Grant the dynamic group (resource principals) access\n` +
      `Allow dynamic-group ${dg || "<dg>"} to ${resourcePrincipal.verb} ${resourcePrincipal.resource} in ${place}${where}`;

    if (resourcePrincipal.scope === "self") {
      validation.push({
        level: "ok",
        html: "Scoped: principals may act only within their own compartment.",
      });
    }
    validation.push({
      level: "ok",
      html: "Resource-principal grant — instances/functions in the DG call OCI as themselves.",
    });
    validation.push({
      level: "warn",
      html: "Pair this with the matching dynamic group definition (Dynamic Group tab).",
    });
  } else if (scenario === "tbac") {
    const subj = `${tbac.subjectType} ${tbac.subject.trim() || "<name>"}`;
    const ns = tbac.tagNamespace.trim();
    const key = tbac.tagKey.trim();
    const val = tbac.tagValue.trim();
    const n = parseInt(tbac.replacedCount, 10) || 0;
    text =
      `Allow ${subj} to ${tbac.verb} ${tbac.resource} in tenancy\n` +
      `  where target.resource.tag.${ns || "<ns>"}.${key || "<key>"} = '${val || "<value>"}'`;
    saved = n > 1 ? String(n - 1) : "—";
    savedClass = "ok";
    validation.push({
      level: "warn",
      html: `Equivalence requires the target resources to actually carry <b>${ns || "<ns>"}.${key || "<key>"}</b>. Verify tag coverage before deploying.`,
    });
    validation.push({
      level: "ok",
      html: `Replaces ~${n} per-compartment statements with 1 tag-scoped statement.`,
    });
  } else if (scenario === "xt") {
    const alias = crossTenancy.alias.trim();
    const ocid = crossTenancy.tenancyOcid.trim();
    const grp = crossTenancy.group.trim();
    const gocid = crossTenancy.groupOcid.trim();
    const loc = crossTenancy.destinationCompartment.trim();
    const def = `Define tenancy ${alias || "<alias>"} as ${ocid || "<tenancy-ocid>"}`;

    if (crossTenancy.role === "source") {
      const defg = `Define group ${grp || "<group>"} as ${gocid || "<group-ocid>"}`;
      const endorse = `Endorse group ${grp || "<group>"} to ${crossTenancy.verb} ${crossTenancy.resource} in any-tenancy`;
      text = `// SOURCE tenancy (where the group lives)\n${defg}\n${endorse}`;
      count = 2;
      validation.push({
        level: "ok",
        html: "Endorse lets your group act in <b>another</b> tenancy.",
      });
      validation.push({
        level: "warn",
        html: "The destination tenancy must publish a matching <b>Admit</b> statement.",
      });
    } else {
      const admit = `Admit group ${grp || "<group>"} of tenancy ${alias || "<alias>"} to ${crossTenancy.verb} ${crossTenancy.resource} in compartment ${loc || "<compartment>"}`;
      text = `// DESTINATION tenancy (where the resources live)\n${def}\n${admit}`;
      count = 2;
      validation.push({
        level: "ok",
        html: "Admit accepts a foreign group into your tenancy with scoped access.",
      });
      validation.push({
        level: "warn",
        html: "The source tenancy must publish a matching <b>Endorse</b> statement.",
      });
    }
  }

  if (scenario !== "dyn" && scenario !== "xt" && scenario !== "tbac") {
    const lines = text.split("\n").filter(
      (l) =>
        l &&
        !l.trim().startsWith("//") &&
        !l.trim().startsWith("where") &&
        !l.trim().startsWith("Name") &&
        !l.trim().startsWith("Compartment") &&
        !l.trim().startsWith("Matching")
    );
    count = lines.length || 1;
  }

  if (scenario !== "tbac") {
    saved = "—";
    savedClass = "ok";
  }

  return { text, count, saved, savedClass, countClass, validation };
}

export function highlightPolicy(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(
      /\b(Allow|Endorse|Admit|Define|Create)\b/g,
      '<span class="text-rose-300 font-bold">$1</span>'
    )
    .replace(
      /\b(to|in|of|as|where|all|any|with|tenancy|compartment|group|dynamic-group|service|any-user)\b/g,
      '<span class="text-amber-300">$1</span>'
    )
    .replace(/'([^']*)'/g, '<span class="text-emerald-300">&#39;$1&#39;</span>')
    .replace(/(\/\/[^\n]*)/g, '<span class="text-slate-400 italic">$1</span>');
}

export function defaultRuleValue(attribute: string): string {
  if (attribute === "resource.type") return "instance";
  if (attribute.startsWith("tag.")) return "Production";
  return "ocid1.compartment.oc1..aaaaexample";
}

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}
