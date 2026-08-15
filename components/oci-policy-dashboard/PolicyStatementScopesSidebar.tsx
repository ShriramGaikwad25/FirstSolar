"use client";

import { useMemo, useState, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type {
  PolicyListStatement,
  PolicyScopeCompartment,
  PolicyScopeDefinedTag,
  PolicyScopeFreeformTag,
  PolicyScopeResource,
  PolicyScopeView,
} from "@/types/oci-policy";
import { usePolicyOptimizationScopes } from "@/hooks/usePolicyOptimizationScopes";
import { resolvePolicyScopeViewFromPayload, buildScopesStatementRef } from "@/lib/policy-optimization-scopes";

const SECTION_THEMES = {
  subject: {
    border: "border-blue-200",
    headerBg: "bg-blue-50",
    headerBorder: "border-blue-100",
    title: "text-blue-900",
    accent: "bg-blue-600",
    label: "text-blue-700",
    detailBorder: "border-blue-100",
  },
  groups: {
    border: "border-indigo-200",
    headerBg: "bg-indigo-50",
    headerBorder: "border-indigo-100",
    title: "text-indigo-900",
    accent: "bg-indigo-500",
    label: "text-indigo-700",
    detailBorder: "border-indigo-100",
  },
  resources: {
    border: "border-slate-200",
    headerBg: "bg-slate-50",
    headerBorder: "border-slate-200",
    title: "text-slate-800",
    accent: "bg-slate-600",
    label: "text-slate-600",
    detailBorder: "border-slate-200",
    badge: "bg-slate-600 text-white",
    panel: "bg-slate-50",
    card: "border-slate-200 bg-white",
    button: "border-slate-300 text-slate-700 hover:bg-slate-100",
    chevron: "text-slate-500",
    compartmentBar: "border-l-slate-500",
    compartmentHeader: "bg-gradient-to-r from-slate-100 to-white hover:from-slate-100/90",
    compartmentHeaderExpanded: "bg-slate-100",
    compartmentTitle: "text-slate-900",
  },
  constraints: {
    border: "border-blue-200",
    headerBg: "bg-blue-50",
    headerBorder: "border-blue-100",
    title: "text-blue-900",
    accent: "bg-blue-500",
    label: "text-blue-800",
    detailBorder: "border-blue-100",
    item: "border-blue-100 bg-blue-50/80 text-blue-950",
  },
  notes: {
    border: "border-sky-200",
    headerBg: "bg-sky-50",
    headerBorder: "border-sky-100",
    title: "text-sky-900",
    accent: "bg-sky-500",
    label: "text-sky-800",
    detailBorder: "border-sky-100",
    body: "text-sky-950",
  },
} as const;

type SectionTheme = keyof typeof SECTION_THEMES;

function ScopeSectionCard({
  title,
  theme,
  children,
  prominentHeader = true,
}: {
  title: string;
  theme: SectionTheme;
  children: ReactNode;
  prominentHeader?: boolean;
}) {
  const colors = SECTION_THEMES[theme];

  return (
    <section className={`overflow-hidden rounded-lg border ${colors.border} bg-white shadow-sm`}>
      <div
        className={`flex items-center gap-2.5 border-b ${colors.headerBorder} ${colors.headerBg} ${
          prominentHeader ? "px-4 py-3" : "px-3.5 py-2"
        }`}
      >
        <div
          className={`shrink-0 rounded-full ${colors.accent} ${
            prominentHeader ? "h-5 w-1.5" : "h-4 w-1"
          }`}
          aria-hidden
        />
        <h3
          className={`uppercase tracking-wide ${colors.title} ${
            prominentHeader ? "text-sm font-bold" : "text-xs font-semibold"
          }`}
        >
          {title}
        </h3>
      </div>
      <div className={prominentHeader ? "px-3 py-2.5" : "px-3.5 py-3"}>{children}</div>
    </section>
  );
}

function DetailList({
  rows,
  theme = "subject",
  compact = true,
}: {
  rows: { label: string; value: ReactNode }[];
  theme?: SectionTheme;
  compact?: boolean;
}) {
  const colors = SECTION_THEMES[theme];

  return (
    <dl className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`grid grid-cols-[5rem_1fr] gap-x-3 gap-y-0.5 first:rounded-t-md last:rounded-b-md sm:grid-cols-[5.5rem_1fr] ${
            compact ? "px-2.5 py-2" : "px-3 py-2.5"
          }`}
        >
          <dt
            className={`font-semibold uppercase tracking-wide ${colors.label} ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            {row.label}
          </dt>
          <dd
            className={`min-w-0 text-gray-900 [overflow-wrap:anywhere] ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyValue() {
  return <span className="text-gray-400">—</span>;
}

function TagsBlock({
  title,
  children,
  tone = "defined",
}: {
  title: string;
  children: ReactNode;
  tone?: "defined" | "freeform";
}) {
  const titleClass = "text-blue-700";

  return (
    <div className="space-y-1.5">
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${titleClass}`}>{title}</p>
      {children}
    </div>
  );
}

function DefinedTagsTable({ tags }: { tags: PolicyScopeDefinedTag[] }) {
  if (tags.length === 0) return <EmptyValue />;

  return (
    <div className="overflow-x-auto rounded-md border border-blue-100">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[22%]" />
          <col className="w-[48%]" />
        </colgroup>
        <thead>
          <tr className="bg-blue-50/90">
            <th className="border-b border-blue-100 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-blue-800">
              Namespace
            </th>
            <th className="border-b border-blue-100 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-blue-800">
              Key
            </th>
            <th className="border-b border-blue-100 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-blue-800">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {tags.map((tag, index) => (
            <tr key={`${tag.namespace}-${tag.key}-${index}`} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
              <td className="break-words px-2 py-1.5 text-gray-800 [overflow-wrap:anywhere]">{tag.namespace}</td>
              <td className="break-words px-2 py-1.5 text-gray-800 [overflow-wrap:anywhere]">{tag.key}</td>
              <td className="break-words px-2 py-1.5 text-gray-800 [overflow-wrap:anywhere]">{tag.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FreeformTagsTable({ tags }: { tags: PolicyScopeFreeformTag[] }) {
  if (tags.length === 0) return <EmptyValue />;

  return (
    <div className="overflow-x-auto rounded-md border border-blue-100">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-blue-50/90">
            <th className="border-b border-blue-100 px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-blue-900">
              Key
            </th>
            <th className="border-b border-blue-100 px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-blue-900">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {tags.map((tag, index) => (
            <tr key={`${tag.key}-${index}`} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
              <td className="px-2.5 py-1.5 text-gray-800 [overflow-wrap:anywhere]">{tag.key}</td>
              <td className="px-2.5 py-1.5 text-gray-800 [overflow-wrap:anywhere]">{tag.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function lifecycleStateTone(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (["RUNNING", "ACTIVE", "AVAILABLE", "ENABLED"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (["STOPPED", "INACTIVE", "DISABLED", "TERMINATED"].includes(normalized)) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  if (["PROVISIONING", "CREATING", "UPDATING"].includes(normalized)) {
    return "bg-blue-100 text-blue-800 ring-blue-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

const RESOURCE_CARD_ACCENTS = [
  "border-l-violet-500",
  "border-l-sky-500",
  "border-l-cyan-500",
  "border-l-rose-500",
  "border-l-indigo-500",
  "border-l-teal-500",
] as const;

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${lifecycleStateTone(state)}`}
    >
      {state}
    </span>
  );
}

function MetaChip({
  label,
  tone,
}: {
  label: string;
  tone: "sky" | "slate" | "violet" | "blue";
}) {
  const toneClass =
    tone === "sky"
      ? "bg-sky-50 text-sky-800 ring-sky-200"
      : tone === "violet"
        ? "bg-violet-50 text-violet-800 ring-violet-200"
        : tone === "blue"
          ? "bg-blue-50 text-blue-800 ring-blue-200"
          : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex max-w-full rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset [overflow-wrap:anywhere] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function ResourceCard({ resource, index }: { resource: PolicyScopeResource; index: number }) {
  const hasDefinedTags = resource.definedTags.length > 0;
  const hasFreeformTags = resource.freeformTags.length > 0;
  const accent = RESOURCE_CARD_ACCENTS[index % RESOURCE_CARD_ACCENTS.length];

  return (
    <article className={`overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm border-l-4 ${accent}`}>
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 bg-slate-50/70 px-3 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">
            {resource.displayName}
          </p>
          {resource.resourceType ? (
            <MetaChip label={`TYPE: ${resource.resourceType}`} tone="blue" />
          ) : null}
        </div>
        <StateBadge state={resource.lifecycleState} />
      </div>

      {(hasDefinedTags || hasFreeformTags) && (
        <div className="space-y-2 border-t border-gray-100 bg-gray-50/80 px-3 py-2.5">
          {hasDefinedTags && (
            <TagsBlock title="Defined tags" tone="defined">
              <DefinedTagsTable tags={resource.definedTags} />
            </TagsBlock>
          )}
          {hasFreeformTags && (
            <TagsBlock title="Freeform tags" tone="freeform">
              <FreeformTagsTable tags={resource.freeformTags} />
            </TagsBlock>
          )}
        </div>
      )}
    </article>
  );
}

const INITIAL_RESOURCES_PER_COMPARTMENT = 5;

function ResourcesInScopeSection({
  compartments,
  resourceCount,
  compact = false,
}: {
  compartments: PolicyScopeCompartment[];
  resourceCount: number | null;
  compact?: boolean;
}) {
  const [expandedCompartments, setExpandedCompartments] = useState<Record<string, boolean>>({});
  const [showAllInCompartment, setShowAllInCompartment] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedCompartments({});
    setShowAllInCompartment({});
  }, [compartments, resourceCount]);

  const resourceTheme = SECTION_THEMES.resources;

  if (compartments.length === 0) {
    return (
      <p className={compact ? "text-xs text-gray-500" : "text-sm text-gray-500"}>
        {resourceCount != null && resourceCount > 0
          ? `${resourceCount.toLocaleString()} resources in scope (not enumerated in API response).`
          : "—"}
      </p>
    );
  }

  const totalFromCompartments = compartments.reduce((sum, compartment) => sum + compartment.count, 0);
  const totalLabel =
    resourceCount != null && resourceCount !== totalFromCompartments
      ? `${resourceCount.toLocaleString()} total · ${compartments.length} compartments`
      : `${totalFromCompartments.toLocaleString()} resource${totalFromCompartments === 1 ? "" : "s"} · ${compartments.length} compartment${compartments.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-2">
      <p className={`${resourceTheme.label} ${compact ? "text-[11px]" : "text-xs"}`}>{totalLabel}</p>
      {compartments.map((compartment) => {
        const compartmentName = compartment.compartmentName;
        const expanded = expandedCompartments[compartmentName] ?? false;
        const showAll = showAllInCompartment[compartmentName] ?? false;
        const compartmentResources = compartment.resources;
        const visibleResources = showAll
          ? compartmentResources
          : compartmentResources.slice(0, INITIAL_RESOURCES_PER_COMPARTMENT);
        const hiddenCount = compartmentResources.length - visibleResources.length;
        const badgeCount = compartment.count || compartmentResources.length;

        return (
          <div
            key={compartmentName}
            className={`overflow-hidden rounded-lg border ${resourceTheme.detailBorder} bg-white shadow-sm`}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedCompartments((current) => ({
                  ...current,
                  [compartmentName]: !expanded,
                }))
              }
              className={`flex w-full items-center justify-between gap-2 border-l-4 ${resourceTheme.compartmentBar} px-3 text-left transition-colors ${
                compact ? "py-2" : "py-2.5"
              } ${
                expanded ? resourceTheme.compartmentHeaderExpanded : resourceTheme.compartmentHeader
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {expanded ? (
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${resourceTheme.chevron}`} aria-hidden />
                ) : (
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${resourceTheme.chevron}`} aria-hidden />
                )}
                <span
                  className={`truncate font-semibold ${resourceTheme.compartmentTitle} ${
                    compact ? "text-xs" : "text-sm"
                  }`}
                >
                  {compartmentName}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full font-semibold ${resourceTheme.badge} ${
                  compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
                }`}
              >
                {badgeCount}
              </span>
            </button>
            {expanded && (
              <div className={`space-y-2.5 border-t ${resourceTheme.headerBorder} ${resourceTheme.panel} p-2.5`}>
                {compartmentResources.length === 0 ? (
                  <p className="px-1 py-1 text-sm text-gray-500">
                    {badgeCount > 0
                      ? `${badgeCount.toLocaleString()} resources (details not included in response).`
                      : "No resources listed."}
                  </p>
                ) : (
                  <>
                    {visibleResources.map((resource, index) => (
                      <ResourceCard
                        key={`${resource.displayName}-${resource.resourceType}-${index}`}
                        resource={resource}
                        index={index}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllInCompartment((current) => ({
                            ...current,
                            [compartmentName]: true,
                          }))
                        }
                        className={`w-full rounded-md border border-dashed bg-white px-3 py-2 text-xs font-medium ${resourceTheme.button}`}
                      >
                        Show {hiddenCount} more
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubjectSection({ scopeView }: { scopeView: PolicyScopeView }) {
  return (
    <ScopeSectionCard title="Subject" theme="subject">
      <DetailList
        theme="subject"
        rows={[
          { label: "Kind", value: scopeView.subject?.kind ?? <EmptyValue /> },
          { label: "Name", value: scopeView.subject?.name ?? <EmptyValue /> },
        ]}
      />
    </ScopeSectionCard>
  );
}

function GroupsInScopeSection({ scopeView }: { scopeView: PolicyScopeView }) {
  return (
    <ScopeSectionCard title="Groups in scope" theme="groups">
      <DetailList
        theme="groups"
        rows={[
          { label: "Kind", value: scopeView.subject?.kind ?? <EmptyValue /> },
          {
            label: "Name",
            value:
              scopeView.groupsInScope.length === 1 ? (
                scopeView.groupsInScope[0]
              ) : (
                <ul className="space-y-1">
                  {scopeView.groupsInScope.map((groupName, index) => (
                    <li key={`${groupName}-${index}`}>{groupName}</li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </ScopeSectionCard>
  );
}

function PolicyScopeDetails({ scopeView }: { scopeView: PolicyScopeView }) {
  const hasGroupsInScope = scopeView.groupsInScope.length > 0;
  const hasResidualConstraints = scopeView.residualConstraints.length > 0;
  const hasNotes = Boolean(scopeView.notes?.trim());

  return (
    <div className="space-y-3">
      {hasGroupsInScope ? (
        <GroupsInScopeSection scopeView={scopeView} />
      ) : (
        <SubjectSection scopeView={scopeView} />
      )}

      <ScopeSectionCard title="Resources in scope" theme="resources">
        <ResourcesInScopeSection
          compact
          compartments={scopeView.compartmentsInScope}
          resourceCount={scopeView.resourceCount}
        />
      </ScopeSectionCard>

      {hasResidualConstraints && (
        <ScopeSectionCard title="Residual constraints" theme="constraints">
          <ul className="space-y-1.5">
            {scopeView.residualConstraints.map((expression, index) => (
              <li
                key={`${expression}-${index}`}
                className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] leading-relaxed [overflow-wrap:anywhere] ${SECTION_THEMES.constraints.item}`}
              >
                {expression}
              </li>
            ))}
          </ul>
        </ScopeSectionCard>
      )}

      {hasNotes && (
        <ScopeSectionCard title="Notes" theme="notes">
          <p className={`whitespace-pre-wrap text-xs leading-relaxed [overflow-wrap:anywhere] ${SECTION_THEMES.notes.body}`}>
            {scopeView.notes?.trim()}
          </p>
        </ScopeSectionCard>
      )}
    </div>
  );
}

export function getStatementLookupRef(
  _statement: PolicyListStatement,
  index: number,
  policyName?: string
): string {
  const trimmedPolicy = policyName?.trim();
  if (trimmedPolicy) return buildScopesStatementRef(trimmedPolicy, index);

  const rawRef = _statement.ref?.trim();
  if (rawRef?.includes("#")) return rawRef;
  if (rawRef) return rawRef.startsWith("#") ? rawRef : `#${rawRef.replace(/^#/, "")}`;
  return `#${index}`;
}

export default function PolicyStatementScopesSidebar({
  policyName,
  statementRef,
  statementIndex,
  statement,
}: {
  policyName: string;
  statementRef: string;
  statementIndex: number;
  statement: PolicyListStatement;
  onClose?: () => void;
}) {
  const lookupRef = getStatementLookupRef(statement, statementIndex, policyName);
  const { data, isLoading, isError, error } = usePolicyOptimizationScopes(policyName);

  const scopeView = useMemo(() => {
    if (!data?.scopes) {
      return resolvePolicyScopeViewFromPayload(null, {
        policyName,
        statementRef: lookupRef,
        statementId: statement.id,
        statementIndex,
        statement,
      });
    }

    return resolvePolicyScopeViewFromPayload(data, {
      policyName,
      statementRef: lookupRef,
      statementId: statement.id,
      statementIndex,
      statement,
    });
  }, [data, lookupRef, policyName, statement, statementIndex]);

  return (
    <div className="text-gray-900">
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading scopes…
        </div>
      ) : isError ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-900">
            {error instanceof Error ? error.message : "Failed to load policy scopes"}.
          </p>
          <PolicyScopeDetails scopeView={scopeView} />
        </div>
      ) : (
        <PolicyScopeDetails scopeView={scopeView} />
      )}
    </div>
  );
}
