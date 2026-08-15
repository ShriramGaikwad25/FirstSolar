"use client";

import { ChevronRight } from "lucide-react";
import {
  getPolicyStatementDisplayFields,
  GRAPH_NODE_KIND_LABELS,
} from "@/lib/oci-policy-graph";
import type { PolicyListRisk, PolicyListStatement } from "@/types/oci-policy";
import { assignDemoStatementRisk } from "@/lib/oci-policy-list-enrichment";

const ACTION_COLUMN_WIDTH = "3.25rem";
const WRAP_CELL = "whitespace-normal break-words [overflow-wrap:anywhere]";
const STATEMENT_TH =
  "px-3 py-2 text-left text-[11px] font-semibold text-blue-800 uppercase tracking-wide bg-blue-50/80 border-b border-blue-100 whitespace-normal break-words";
const STATEMENT_TH_CENTER = `${STATEMENT_TH} text-center`;
const STATEMENT_TH_ACTION = `${STATEMENT_TH} text-right whitespace-nowrap`;
const STATEMENT_TD = `px-3 py-2.5 align-top bg-white text-sm text-slate-800 ${WRAP_CELL}`;
const STATEMENT_TD_MUTED = `${STATEMENT_TD} text-slate-600`;
const STATEMENT_TD_ACTION = "px-3 py-2.5 align-top text-right bg-white whitespace-nowrap";

function StatementFieldCell({ value }: { value: string }) {
  if (value === "—") {
    return <span className="text-slate-400">—</span>;
  }

  return <span className="break-words [overflow-wrap:anywhere]">{value}</span>;
}

function statementRiskClass(risk: PolicyListRisk): string {
  if (risk === "High") return "text-red-700 font-semibold";
  if (risk === "Medium") return "text-yellow-600 font-semibold";
  return "text-green-700 font-semibold";
}

function statementRisk(
  policyName: string,
  index: number,
  statement: PolicyListStatement
): PolicyListRisk {
  return statement.risk ?? assignDemoStatementRisk(policyName, index);
}

export function formatStatementRef(ref: string | undefined, index: number): string {
  if (!ref) return String(index + 1);
  const stripped = ref.replace(/^#/, "").trim();
  if (/^\d+$/.test(stripped)) return String(Number(stripped) + 1);
  return ref.startsWith("#") ? ref : `#${ref}`;
}

export function PolicyStatementsPanel({
  policyName,
  statements,
  isLoading = false,
  selectedStatementIndex = null,
  onStatementClick,
  hideStatementColumn = false,
  statementOnlyMode = false,
}: {
  policyName: string;
  statements: PolicyListStatement[];
  isLoading?: boolean;
  selectedStatementIndex?: number | null;
  onStatementClick?: (index: number, statement: PolicyListStatement) => void;
  hideStatementColumn?: boolean;
  statementOnlyMode?: boolean;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm"
      data-right-sidebar-keep
    >
      <div className="border-b border-blue-100 bg-blue-50/50 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-blue-900">
          Policy statements
          <span className="ml-2 font-normal text-gray-500">— {policyName}</span>
        </h2>
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-gray-500">Loading statements…</p>
      ) : statements.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-600">
          No statement text returned from the API for {policyName}.
        </p>
      ) : (
        <div>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {statementOnlyMode ? (
                <>
                  <col />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "14%" }} />
                </>
              ) : (
                <>
                  {!hideStatementColumn && <col />}
                  <col style={{ width: "7%" }} />
                  <col style={{ width: hideStatementColumn ? "20%" : "14%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: hideStatementColumn ? "13%" : "10%" }} />
                  <col style={{ width: hideStatementColumn ? "18%" : "13%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: hideStatementColumn ? "13%" : "10%" }} />
                  <col style={{ width: ACTION_COLUMN_WIDTH }} />
                </>
              )}
            </colgroup>
            <thead>
              <tr>
                {statementOnlyMode ? (
                  <>
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.PolicyStatement}
                    </th>
                    <th scope="col" className={STATEMENT_TH_CENTER}>
                      Risk
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      Impact
                    </th>
                  </>
                ) : (
                  <>
                    {!hideStatementColumn && (
                      <th scope="col" className={STATEMENT_TH}>
                        {GRAPH_NODE_KIND_LABELS.PolicyStatement}
                      </th>
                    )}
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.StatementType}
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.Group}
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.Action}
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.ResourceType}
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.Compartment}
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      {GRAPH_NODE_KIND_LABELS.Condition}
                    </th>
                    <th scope="col" className={STATEMENT_TH_CENTER}>
                      Risk
                    </th>
                    <th scope="col" className={STATEMENT_TH}>
                      Impact
                    </th>
                    <th scope="col" className={STATEMENT_TH_ACTION} aria-label="View scopes">
                      <span className="sr-only">View scopes</span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {statements.map((statement, index) => {
                const isSelected = selectedStatementIndex === index;
                const fields = getPolicyStatementDisplayFields(statement);
                const risk = statementRisk(policyName, index, statement);

                return (
                  <tr
                    key={`${statement.id}-${index}`}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`Statement ${formatStatementRef(statement.ref, index)}`}
                    onClick={() => onStatementClick?.(index, statement)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onStatementClick?.(index, statement);
                      }
                    }}
                    className={`border-b border-slate-100 last:border-b-0 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                      isSelected
                        ? "bg-blue-50 ring-2 ring-inset ring-blue-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {statementOnlyMode ? (
                      <>
                        <td className={STATEMENT_TD}>
                          <pre
                            className={`m-0 whitespace-pre-wrap font-mono text-sm leading-relaxed [overflow-wrap:anywhere] ${
                              isSelected ? "text-blue-950" : "text-slate-800"
                            }`}
                          >
                            {statement.text}
                          </pre>
                        </td>
                        <td className={`${STATEMENT_TD} text-center whitespace-nowrap ${statementRiskClass(risk)}`}>
                          {risk}
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <span className="block text-xs">442 resources</span>
                          <span className="block text-xs">12 compartments</span>
                        </td>
                      </>
                    ) : (
                      <>
                        {!hideStatementColumn && (
                          <td className={STATEMENT_TD}>
                            <pre
                              className={`m-0 whitespace-pre-wrap font-mono text-sm leading-relaxed [overflow-wrap:anywhere] ${
                                isSelected ? "text-blue-950" : "text-slate-800"
                              }`}
                            >
                              {statement.text}
                            </pre>
                          </td>
                        )}
                        <td className={STATEMENT_TD_MUTED}>
                          <StatementFieldCell value={fields.type} />
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <StatementFieldCell value={fields.subject} />
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <StatementFieldCell value={fields.verb} />
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <StatementFieldCell value={fields.resource} />
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <StatementFieldCell value={fields.compartment} />
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <StatementFieldCell value={fields.condition} />
                        </td>
                        <td className={`${STATEMENT_TD} text-center whitespace-nowrap ${statementRiskClass(risk)}`}>
                          {risk}
                        </td>
                        <td className={STATEMENT_TD_MUTED}>
                          <span className="block text-xs">442 resources</span>
                          <span className="block text-xs">12 compartments</span>
                        </td>
                      </>
                    )}
                    {!statementOnlyMode && (
                      <td className={STATEMENT_TD_ACTION}>
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white shadow-sm ${
                            isSelected
                              ? "border-blue-400 text-blue-700"
                              : "border-blue-200 text-blue-600"
                          }`}
                          aria-hidden
                        >
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
