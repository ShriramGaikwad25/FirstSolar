"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, FileCode2, Loader2, Play, Plus, X } from "lucide-react";
import { PolicyRecommendationResults } from "@/components/oci-policy-builder/PolicyRecommendationResults";
import { DEFAULT_POLICY_RECOMMENDATION_NAME } from "@/lib/policy-recommendation-api";
import {
  buildPreview,
  COND_VARS,
  createId,
  defaultRuleValue,
  familyHintText,
  FAMILIES,
  highlightPolicy,
  RES_OPTIONS,
  RULE_ATTRS,
  type AccessForm,
  type ConditionRow,
  type CrossTenancyForm,
  type DynamicGroupForm,
  type ResourcePrincipalForm,
  type RuleRow,
  type ScenarioId,
  type TbacForm,
} from "@/lib/oci-policy-builder";

const SCENARIOS: { id: ScenarioId; label: string; hint: string }[] = [
  { id: "access", label: "Access Policy", hint: "Allow a subject" },
  { id: "dyn", label: "Dynamic Group", hint: "Matching rules" },
  { id: "rp", label: "Resource Principal", hint: "Instance/function grants" },
  { id: "tbac", label: "TBAC", hint: "Tag-driven" },
  { id: "xt", label: "Cross-Tenancy", hint: "Define / Endorse / Admit" },
];

const INPUT =
  "w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const SELECT = INPUT;
const LABEL = "mb-1 block text-xs font-semibold text-gray-800";
const HINT = "font-normal text-gray-500";

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className={LABEL}>
      {children}
      {hint && <span className={` ${HINT}`}> {hint}</span>}
    </label>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-blue-700">
      {children}
    </h2>
  );
}

function HelpBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-r-md border-l-[3px] border-blue-600 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
      {children}
    </div>
  );
}

function CombineChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-300 bg-gray-100 text-gray-600 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-300">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            value === opt.value
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ConditionRows({
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: ConditionRow[];
  onChange: (id: string, patch: Partial<ConditionRow>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1.2fr_0.5fr_1fr_auto] items-center gap-2"
          >
            <select
              className={SELECT}
              value={row.variable}
              onChange={(e) => onChange(row.id, { variable: e.target.value })}
            >
              {COND_VARS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className={SELECT}
              value={row.operator}
              onChange={(e) =>
                onChange(row.id, { operator: e.target.value as "=" | "!=" })
              }
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
            </select>
            <input
              type="text"
              className={INPUT}
              placeholder="value"
              value={row.value}
              onChange={(e) => onChange(row.id, { value: e.target.value })}
            />
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-red-600 hover:bg-red-50"
              aria-label="Remove condition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add condition
      </button>
    </div>
  );
}

function RuleRows({
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: RuleRow[];
  onChange: (id: string, patch: Partial<RuleRow>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1.2fr_0.5fr_1fr_auto] items-center gap-2"
          >
            <select
              className={SELECT}
              value={row.attribute}
              onChange={(e) => {
                const attribute = e.target.value;
                onChange(row.id, {
                  attribute,
                  value: defaultRuleValue(attribute),
                });
              }}
            >
              {RULE_ATTRS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className={SELECT}
              value={row.operator}
              onChange={(e) =>
                onChange(row.id, { operator: e.target.value as "=" | "!=" })
              }
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
            </select>
            <input
              type="text"
              className={INPUT}
              placeholder="value"
              value={row.value}
              onChange={(e) => onChange(row.id, { value: e.target.value })}
            />
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-red-600 hover:bg-red-50"
              aria-label="Remove rule"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add rule
      </button>
    </div>
  );
}

function ResourceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
      {RES_OPTIONS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

export default function OciPolicyBuilderPage() {
  const [scenario, setScenario] = useState<ScenarioId>("access");
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<unknown>(null);
  const [simulationStatement, setSimulationStatement] = useState("");

  const [access, setAccess] = useState<AccessForm>({
    subjectType: "group",
    subject: "'Default'/'kf-iam-export-readers'",
    verb: "read",
    resource: "groups",
    locType: "tenancy",
    location: "Network:Prod",
    conditions: [],
    combine: "all",
  });

  const [dynamicGroup, setDynamicGroup] = useState<DynamicGroupForm>({
    name: "prod-app-instances",
    compartment: "Apps:Prod",
    combine: "ANY",
    rules: [
      {
        id: createId(),
        attribute: "instance.compartment.id",
        operator: "=",
        value: "ocid1.compartment.oc1..aaaaexample",
      },
    ],
  });

  const [resourcePrincipal, setResourcePrincipal] = useState<ResourcePrincipalForm>({
    dynamicGroup: "prod-app-instances",
    verb: "use",
    resource: "object-family",
    locType: "compartment",
    location: "Apps:Prod",
    scope: "off",
  });

  const [tbac, setTbac] = useState<TbacForm>({
    subjectType: "group",
    subject: "ProdTeam",
    verb: "manage",
    resource: "all-resources",
    tagNamespace: "Operations",
    tagKey: "Environment",
    tagValue: "Production",
    replacedCount: "12",
  });

  const [crossTenancy, setCrossTenancy] = useState<CrossTenancyForm>({
    role: "source",
    alias: "AcmeCorp",
    tenancyOcid: "ocid1.tenancy.oc1..aaaaexample",
    group: "ObjectBackupAgents",
    groupOcid: "ocid1.group.oc1..aaaaexample",
    verb: "use",
    resource: "object-family",
    destinationCompartment: "Backups",
  });

  const preview = useMemo(
    () => buildPreview(scenario, access, dynamicGroup, resourcePrincipal, tbac, crossTenancy),
    [scenario, access, dynamicGroup, resourcePrincipal, tbac, crossTenancy]
  );

  const highlighted = useMemo(() => highlightPolicy(preview.text), [preview.text]);

  const copyPreview = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(preview.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [preview.text]);

  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    setSimulationError(null);

    try {
      const res = await fetch("/api/oci-policy-recommendation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          policyName: DEFAULT_POLICY_RECOMMENDATION_NAME,
          statement: preview.text,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { data?: unknown; result?: unknown; message?: string }
        | null;

      if (!res.ok) {
        throw new Error(payload?.message ?? `Simulation failed (${res.status})`);
      }

      setSimulationStatement(preview.text);
      setSimulationResult(payload?.data ?? payload);
    } catch (error) {
      setSimulationResult(null);
      setSimulationStatement("");
      setSimulationError(
        error instanceof Error ? error.message : "Failed to simulate policy recommendation"
      );
    } finally {
      setIsSimulating(false);
    }
  }, [preview.text]);

  const countAccent =
    preview.countClass === "red"
      ? "text-red-600"
      : preview.countClass === "warn"
        ? "text-amber-600"
        : "text-emerald-600";

  const savedAccent =
    preview.savedClass === "ok" && preview.saved !== "—"
      ? "text-emerald-600"
      : "text-gray-900";

  const familyHint =
    scenario === "access" ? familyHintText(access.resource) : null;

  return (
    <div className="relative w-full min-w-0">
      <div className="mb-4 shrink-0">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600">
              <FileCode2 className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">OCI Policy Builder</h1>
              <p className="mt-0.5 text-sm text-gray-600">
                Compose valid IAM statements, dynamic groups & cross-tenancy policy — with live
                preview
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-gray-300 px-2.5 py-1 text-[11px] text-gray-500">
            Oracle Cloud Infrastructure
          </span>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-220px)] grid-cols-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:grid-cols-2">
        {/* Left: builder */}
        <div className="overflow-auto border-b border-gray-200 p-4 xl:border-b-0 xl:border-r">
          <div className="mb-4 flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenario(s.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  scenario === s.id
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                }`}
              >
                {s.label}
                <span
                  className={`mt-0.5 block text-[10.5px] font-normal ${
                    scenario === s.id ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {s.hint}
                </span>
              </button>
            ))}
          </div>

          {scenario === "access" && (
            <div>
              <PanelTitle>Access policy statement</PanelTitle>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Subject type</FieldLabel>
                  <select
                    className={SELECT}
                    value={access.subjectType}
                    onChange={(e) =>
                      setAccess((a) => ({ ...a, subjectType: e.target.value }))
                    }
                  >
                    <option value="group">group</option>
                    <option value="dynamic-group">dynamic-group</option>
                    <option value="service">service</option>
                    <option value="any-user">any-user</option>
                  </select>
                </div>
                <div>
                  <FieldLabel hint="(group / DG / service)">Subject name</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={access.subject}
                    onChange={(e) => setAccess((a) => ({ ...a, subject: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Verb</FieldLabel>
                  <select
                    className={SELECT}
                    value={access.verb}
                    onChange={(e) => setAccess((a) => ({ ...a, verb: e.target.value }))}
                  >
                    <option>inspect</option>
                    <option>read</option>
                    <option>use</option>
                    <option>manage</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Resource-type</FieldLabel>
                  <ResourceSelect
                    value={access.resource}
                    onChange={(resource) => setAccess((a) => ({ ...a, resource }))}
                  />
                </div>
              </div>
              {familyHint && (
                <p className="mb-3 text-xs leading-relaxed text-gray-500">
                  {FAMILIES[access.resource] ? (
                    <>
                      <span className="font-semibold text-gray-800">{access.resource}</span>{" "}
                      covers: {FAMILIES[access.resource].join(", ")}
                      {access.resource !== "all-resources" ? " …" : ""}
                    </>
                  ) : (
                    familyHint
                  )}
                </p>
              )}
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Location</FieldLabel>
                  <select
                    className={SELECT}
                    value={access.locType}
                    onChange={(e) => setAccess((a) => ({ ...a, locType: e.target.value }))}
                  >
                    <option value="tenancy">tenancy</option>
                    <option value="compartment">compartment</option>
                  </select>
                </div>
                <div>
                  <FieldLabel hint="(path)">Compartment</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={access.location}
                    onChange={(e) => setAccess((a) => ({ ...a, location: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <FieldLabel hint="— optional where clause">Conditions</FieldLabel>
                <ConditionRows
                  rows={access.conditions}
                  onChange={(id, patch) =>
                    setAccess((a) => ({
                      ...a,
                      conditions: a.conditions.map((c) =>
                        c.id === id ? { ...c, ...patch } : c
                      ),
                    }))
                  }
                  onAdd={() =>
                    setAccess((a) => ({
                      ...a,
                      conditions: [
                        ...a.conditions,
                        {
                          id: createId(),
                          variable: "request.region",
                          operator: "=",
                          value: "us-ashburn-1",
                        },
                      ],
                    }))
                  }
                  onRemove={(id) =>
                    setAccess((a) => ({
                      ...a,
                      conditions: a.conditions.filter((c) => c.id !== id),
                    }))
                  }
                />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-800">
                  Combine with:
                  <CombineChip
                    active={access.combine === "all"}
                    onClick={() => setAccess((a) => ({ ...a, combine: "all" }))}
                  >
                    all {"{ }"} (AND)
                  </CombineChip>
                  <CombineChip
                    active={access.combine === "any"}
                    onClick={() => setAccess((a) => ({ ...a, combine: "any" }))}
                  >
                    any {"{ }"} (OR)
                  </CombineChip>
                </div>
              </div>
            </div>
          )}

          {scenario === "dyn" && (
            <div>
              <PanelTitle>Dynamic group — matching rules</PanelTitle>
              <HelpBox>
                A dynamic group has no members you add by hand — membership is computed from{" "}
                <b>matching rules</b> over resource attributes (instance OCID, compartment,
                defined tags). Resource principals that match are admitted automatically.
              </HelpBox>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={dynamicGroup.name}
                    onChange={(e) =>
                      setDynamicGroup((d) => ({ ...d, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Compartment</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={dynamicGroup.compartment}
                    onChange={(e) =>
                      setDynamicGroup((d) => ({ ...d, compartment: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="mb-3">
                <FieldLabel>Match</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <CombineChip
                    active={dynamicGroup.combine === "ANY"}
                    onClick={() => setDynamicGroup((d) => ({ ...d, combine: "ANY" }))}
                  >
                    ANY {"{ }"}
                  </CombineChip>
                  <CombineChip
                    active={dynamicGroup.combine === "ALL"}
                    onClick={() => setDynamicGroup((d) => ({ ...d, combine: "ALL" }))}
                  >
                    ALL {"{ }"}
                  </CombineChip>
                  <span className="text-[11px] text-gray-500">of the rules below</span>
                </div>
              </div>
              <div>
                <FieldLabel>Matching rules</FieldLabel>
                <RuleRows
                  rows={dynamicGroup.rules}
                  onChange={(id, patch) =>
                    setDynamicGroup((d) => ({
                      ...d,
                      rules: d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
                    }))
                  }
                  onAdd={() =>
                    setDynamicGroup((d) => ({
                      ...d,
                      rules: [
                        ...d.rules,
                        {
                          id: createId(),
                          attribute: "instance.compartment.id",
                          operator: "=",
                          value: "ocid1.compartment.oc1..aaaaexample",
                        },
                      ],
                    }))
                  }
                  onRemove={(id) =>
                    setDynamicGroup((d) => ({
                      ...d,
                      rules: d.rules.filter((r) => r.id !== id),
                    }))
                  }
                />
              </div>
            </div>
          )}

          {scenario === "rp" && (
            <div>
              <PanelTitle>Resource-principal access grant</PanelTitle>
              <HelpBox>
                Grant a <b>dynamic group</b> (instances, functions, etc. acting as principals)
                permission to call OCI services. Pairs with a dynamic group from the previous tab.
              </HelpBox>
              <div className="mb-3">
                <FieldLabel>Dynamic group</FieldLabel>
                <input
                  type="text"
                  className={INPUT}
                  value={resourcePrincipal.dynamicGroup}
                  onChange={(e) =>
                    setResourcePrincipal((r) => ({ ...r, dynamicGroup: e.target.value }))
                  }
                />
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Verb</FieldLabel>
                  <select
                    className={SELECT}
                    value={resourcePrincipal.verb}
                    onChange={(e) =>
                      setResourcePrincipal((r) => ({ ...r, verb: e.target.value }))
                    }
                  >
                    <option>inspect</option>
                    <option>read</option>
                    <option>use</option>
                    <option>manage</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Resource-type</FieldLabel>
                  <ResourceSelect
                    value={resourcePrincipal.resource}
                    onChange={(resource) =>
                      setResourcePrincipal((r) => ({ ...r, resource }))
                    }
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Location</FieldLabel>
                  <select
                    className={SELECT}
                    value={resourcePrincipal.locType}
                    onChange={(e) =>
                      setResourcePrincipal((r) => ({ ...r, locType: e.target.value }))
                    }
                  >
                    <option value="tenancy">tenancy</option>
                    <option value="compartment">compartment</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Compartment</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={resourcePrincipal.location}
                    onChange={(e) =>
                      setResourcePrincipal((r) => ({ ...r, location: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <FieldLabel hint="— common RP guardrail">
                  Scope to calling resource
                </FieldLabel>
                <SegmentedButtons
                  options={[
                    { value: "off", label: "No extra scope" },
                    { value: "self", label: "Only same compartment" },
                  ]}
                  value={resourcePrincipal.scope}
                  onChange={(scope) => setResourcePrincipal((r) => ({ ...r, scope }))}
                />
              </div>
            </div>
          )}

          {scenario === "tbac" && (
            <div>
              <PanelTitle>Tag-based access (TBAC) — one statement, many compartments</PanelTitle>
              <HelpBox>
                Replace N near-identical per-compartment statements with a single tag-scoped
                statement. Requires the target resources to carry the defined tag.
              </HelpBox>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Subject type</FieldLabel>
                  <select
                    className={SELECT}
                    value={tbac.subjectType}
                    onChange={(e) =>
                      setTbac((t) => ({ ...t, subjectType: e.target.value }))
                    }
                  >
                    <option value="group">group</option>
                    <option value="dynamic-group">dynamic-group</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Subject name</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={tbac.subject}
                    onChange={(e) => setTbac((t) => ({ ...t, subject: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Verb</FieldLabel>
                  <select
                    className={SELECT}
                    value={tbac.verb}
                    onChange={(e) => setTbac((t) => ({ ...t, verb: e.target.value }))}
                  >
                    <option>inspect</option>
                    <option>read</option>
                    <option>use</option>
                    <option>manage</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Resource-type</FieldLabel>
                  <ResourceSelect
                    value={tbac.resource}
                    onChange={(resource) => setTbac((t) => ({ ...t, resource }))}
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1.1fr_0.7fr_1fr]">
                <div>
                  <FieldLabel>Tag namespace</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={tbac.tagNamespace}
                    onChange={(e) =>
                      setTbac((t) => ({ ...t, tagNamespace: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Key</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={tbac.tagKey}
                    onChange={(e) => setTbac((t) => ({ ...t, tagKey: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Value</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={tbac.tagValue}
                    onChange={(e) => setTbac((t) => ({ ...t, tagValue: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <FieldLabel hint="(for savings estimate)">
                  This replaces how many per-compartment statements?
                </FieldLabel>
                <input
                  type="text"
                  className={INPUT}
                  value={tbac.replacedCount}
                  onChange={(e) =>
                    setTbac((t) => ({ ...t, replacedCount: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {scenario === "xt" && (
            <div>
              <PanelTitle>Cross-tenancy policy — Define / Endorse / Admit</PanelTitle>
              <HelpBox>
                Cross-tenancy access takes <b>three</b> coordinated statements: <b>Define</b> the
                foreign tenancy by alias, then the <b>source</b> tenancy <b>Endorses</b> its group
                to act, and the <b>destination</b> tenancy <b>Admits</b> that group. Build both
                sides here.
              </HelpBox>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Your role</FieldLabel>
                  <SegmentedButtons
                    options={[
                      { value: "source", label: "Source (Endorse)" },
                      { value: "dest", label: "Destination (Admit)" },
                    ]}
                    value={crossTenancy.role}
                    onChange={(role) => setCrossTenancy((x) => ({ ...x, role }))}
                  />
                </div>
                <div>
                  <FieldLabel>Foreign tenancy alias</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={crossTenancy.alias}
                    onChange={(e) =>
                      setCrossTenancy((x) => ({ ...x, alias: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="mb-3">
                <FieldLabel hint="(for the Define statement)">Foreign tenancy OCID</FieldLabel>
                <input
                  type="text"
                  className={INPUT}
                  value={crossTenancy.tenancyOcid}
                  onChange={(e) =>
                    setCrossTenancy((x) => ({ ...x, tenancyOcid: e.target.value }))
                  }
                />
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Group (in foreign tenancy)</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={crossTenancy.group}
                    onChange={(e) =>
                      setCrossTenancy((x) => ({ ...x, group: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel hint="(Admit side)">Group OCID</FieldLabel>
                  <input
                    type="text"
                    className={INPUT}
                    value={crossTenancy.groupOcid}
                    onChange={(e) =>
                      setCrossTenancy((x) => ({ ...x, groupOcid: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Verb</FieldLabel>
                  <select
                    className={SELECT}
                    value={crossTenancy.verb}
                    onChange={(e) =>
                      setCrossTenancy((x) => ({ ...x, verb: e.target.value }))
                    }
                  >
                    <option>inspect</option>
                    <option>read</option>
                    <option>use</option>
                    <option>manage</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Resource-type</FieldLabel>
                  <ResourceSelect
                    value={crossTenancy.resource}
                    onChange={(resource) =>
                      setCrossTenancy((x) => ({ ...x, resource }))
                    }
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Destination compartment</FieldLabel>
                <input
                  type="text"
                  className={INPUT}
                  value={crossTenancy.destinationCompartment}
                  onChange={(e) =>
                    setCrossTenancy((x) => ({
                      ...x,
                      destinationCompartment: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div className="overflow-auto bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900">Generated policy</h3>
            <span className="flex-1" />
            <button
              type="button"
              onClick={copyPreview}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          <pre
            className="min-h-[120px] whitespace-pre-wrap break-words rounded-xl bg-slate-800 px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-200"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void runSimulation()}
              disabled={isSimulating || !preview.text.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-600 bg-purple-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSimulating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {isSimulating ? "Simulating…" : "Simulate"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="Statements produced" value={preview.count} accent={countAccent} />
            <StatCard label="Statements saved" value={preview.saved} accent={savedAccent} />
          </div>

          <div className="mt-4 space-y-2">
            {preview.validation.map((v, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                  v.level === "ok"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                <span className="shrink-0 font-bold">{v.level === "ok" ? "✓" : "!"}</span>
                <span dangerouslySetInnerHTML={{ __html: v.html }} />
              </div>
            ))}
          </div>

          <p className="mt-5 text-[10.5px] italic text-gray-500">
            Output wiring (OCI CLI / Terraform / SDK JSON) is stubbed in this mockup — the builder
            logic and validation are live; deployment formats come later.
          </p>
        </div>
      </div>

      {(isSimulating || simulationError || simulationResult != null) && (
        <div className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {isSimulating && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" aria-hidden />
              Running policy recommendation…
            </div>
          )}

          {simulationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {simulationError}
            </div>
          )}

          {!isSimulating && !simulationError && simulationResult != null && (
            <PolicyRecommendationResults
              data={simulationResult}
              statement={simulationStatement}
            />
          )}
        </div>
      )}
    </div>
  );
}
