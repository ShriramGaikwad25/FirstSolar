"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, Copy, Eye, FilePen, Loader2, SendHorizonal, Shield, Trash2, X } from "lucide-react";
import { useOciPolicyList } from "@/hooks/useOciPolicyList";
import { useOciPolicyGraph } from "@/hooks/useOciPolicyGraph";
import { useOciPolicyActivity } from "@/hooks/useOciPolicyActivity";
import { OciPolicyGraphView } from "@/components/OciPolicyGraphView";
import {
  formatStatementRef,
  PolicyStatementsPanel,
} from "@/components/oci-policy-dashboard/PolicyStatementsPanel";
import PolicyStatementScopesSidebar from "@/components/oci-policy-dashboard/PolicyStatementScopesSidebar";
import { ImpactAnalysisPanel } from "@/components/oci-policy-dashboard/ImpactAnalysisPanel";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { validatePolicySyntax, type PolicyValidationResult } from "@/lib/oci-policy-validate-api";
import { savePolicyDraft } from "@/lib/oci-policy-draft-api";
import { restorePolicyVersion } from "@/lib/oci-policy-restore-api";
import { runPolicyImpactAnalysis } from "@/lib/oci-policy-impact-analysis-api";
import type { PolicyListStatement } from "@/types/oci-policy";

type TabId = "overview" | "statements" | "impact" | "versions" | "activity";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "statements", label: "Statements" },
  { id: "versions", label: "Versions" },
  { id: "impact", label: "Impact Analysis" },
  { id: "activity", label: "Activity" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function riskTextClass(risk: string): string {
  if (risk === "High") return "text-red-600 font-semibold";
  if (risk === "Medium") return "text-yellow-600 font-semibold";
  return "text-green-700 font-semibold";
}

function statusPillClass(status: string): string {
  const lower = status.toLowerCase();
  if (lower === "active") return "bg-green-100 text-green-800";
  if (lower === "inactive") return "bg-gray-100 text-gray-700";
  if (lower === "deleted") return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
}

export default function OciPolicyWorkspacePage({ policyName }: { policyName: string }) {
  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useOciPolicyList();
  const {
    data: graphData,
    isLoading: graphLoading,
    isError: graphIsError,
    error: graphError,
  } = useOciPolicyGraph(policyName);
  const { openSidebar, closeSidebar } = useRightSidebar();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [statementsView, setStatementsView] = useState<"full" | "statement">("full");
  const [showEditor, setShowEditor] = useState(false);
  const [draftStatements, setDraftStatements] = useState<string[] | null>(null);
  const [isValidatingSyntax, setIsValidatingSyntax] = useState(false);
  const [validationResult, setValidationResult] = useState<PolicyValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [changeLabel, setChangeLabel] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [saveDraftSuccess, setSaveDraftSuccess] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [restoreVersionError, setRestoreVersionError] = useState<string | null>(null);
  const [restoreVersionSuccess, setRestoreVersionSuccess] = useState<string | null>(null);
  const [runningImpactVersionId, setRunningImpactVersionId] = useState<string | null>(null);
  const [impactAnalysisError, setImpactAnalysisError] = useState<string | null>(null);
  const [impactAnalysisSuccess, setImpactAnalysisSuccess] = useState<string | null>(null);
  const [selectedStatementIndex, setSelectedStatementIndex] = useState<number | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const toggleVersion = (id: string) =>
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [scopeStatement, setScopeStatement] = useState<{
    index: number;
    statement: PolicyListStatement;
  } | null>(null);

  const policy = useMemo(
    () => listData?.policies.find((p) => p.name === policyName),
    [listData?.policies, policyName]
  );

  const {
    data: activityData,
    isLoading: activityLoading,
    isError: activityIsError,
    error: activityError,
  } = useOciPolicyActivity(policy?.uid);

  const policyVersions = activityData?.events ?? [];

  const statements = policy?.statements ?? [];

  const conditionCount = useMemo(
    () => statements.filter((s) => s.condition).length,
    [statements]
  );

  const distinctResources = useMemo(
    () => new Set(statements.map((s) => s.resource).filter(Boolean)).size,
    [statements]
  );

  const distinctSubjects = useMemo(
    () =>
      new Set(statements.flatMap((s) => s.subjects?.map((sub) => sub.name) ?? [])).size,
    [statements]
  );

  const criticalResources = useMemo(
    () =>
      new Set(
        statements
          .filter((s) => s.risk === "High")
          .map((s) => s.resource)
          .filter(Boolean)
      ).size,
    [statements]
  );

  const handleStatementClick = useCallback(
    (index: number, statement: PolicyListStatement) => {
      setSelectedStatementIndex(index);
      setScopeStatement({ index, statement });
    },
    []
  );

  useEffect(() => {
    if (!scopeStatement) return;
    const { index, statement } = scopeStatement;
    const statementRef = formatStatementRef(statement.ref, index);
    openSidebar(
      <PolicyStatementScopesSidebar
        policyName={policyName}
        statementRef={statementRef}
        statementIndex={index}
        statement={statement}
        onClose={closeSidebar}
        key={`${policyName}-stmt-${index}`}
      />,
      { widthPx: 520, title: "Statement scopes", closeOnOutsideClick: false }
    );
  }, [closeSidebar, openSidebar, policyName, scopeStatement]);

  if (listLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading policy…
      </div>
    );
  }

  if (listError || (!listLoading && !policy)) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {!policy && !listError
          ? `Policy "${policyName}" was not found.`
          : "Failed to load policy data."}
      </div>
    );
  }

  if (!policy) return null;

  const subjectCount = distinctSubjects || policy.groups.length;
  const compartmentCount = policy.compartments.length || 1;

  return (
    <div className="w-full min-w-0 pb-10">

      {/* Header card */}
      <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-lg bg-blue-50 p-2.5 text-blue-600">
              <Shield className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{policy.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass(policy.status)}`}
                >
                  {policy.status}
                </span>
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {policy.statementCount} statement{policy.statementCount !== 1 ? "s" : ""}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskTextClass(policy.risk)} bg-opacity-10`}>
                  Risk: {policy.risk}
                </span>
                {policy.owner && (
                  <span>
                    Owner:{" "}
                    <span className="font-medium text-gray-700">{policy.owner}</span>
                  </span>
                )}
                {policy.lastSync && (
                  <span>
                    Last synced:{" "}
                    <span className="font-medium text-gray-700">{formatDate(policy.lastSync)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const seen = new Set<string>();
                const uniqueStatements = statements
                  .map((s) => s.text)
                  .filter((text) => {
                    const key = text.trim().toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                setDraftStatements(uniqueStatements);
                setValidationResult(null);
                setValidationError(null);
                setChangeLabel("");
                setSaveDraftError(null);
                setSaveDraftSuccess(false);
                setShowEditor(true);
              }}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit policy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("versions")}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View versions
            </button>
          </div>
        </div>
      </div>

      {/* Edit Policy modal */}
      {showEditor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowEditor(false); setDraftStatements(null); setValidationResult(null); setValidationError(null); setChangeLabel(""); setSaveDraftError(null); setSaveDraftSuccess(false); } }}
        >
          <div className="flex h-[90vh] w-[95vw] max-w-none flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="font-semibold text-gray-900">
                  Edit {policy.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  The enforced version remains unchanged until a draft is approved and enforced.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowEditor(false); setDraftStatements(null); setValidationResult(null); setValidationError(null); setChangeLabel(""); setSaveDraftError(null); setSaveDraftSuccess(false); }}
                className="ml-4 shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close editor"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Modal body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-900">OCI policy statements</h3>
                {validationResult && (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      validationResult.valid
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {validationResult.valid ? "Syntax valid" : "Syntax errors found"}
                    {(() => {
                      const findingCount = validationResult.results.reduce(
                        (sum, r) => sum + r.findings.length,
                        0
                      );
                      return findingCount > 0 ? ` · ${findingCount} finding${findingCount !== 1 ? "s" : ""}` : "";
                    })()}
                  </span>
                )}
              </div>

              {validationError && (
                <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {validationError}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3">
                {(draftStatements ?? []).map((text, i) => {
                  const statementResult = validationResult?.results[i];
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border bg-white p-3 ${
                        statementResult && !statementResult.valid
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          Statement {i + 1}
                        </span>
                        {statementResult && (
                          <span
                            className={`text-[11px] font-medium ${
                              statementResult.valid ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {statementResult.valid ? "Valid" : "Invalid"}
                          </span>
                        )}
                      </div>
                      <textarea
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }
                        }}
                        value={text}
                        onChange={(e) => {
                          const el = e.target;
                          el.style.height = "auto";
                          el.style.height = `${el.scrollHeight}px`;
                          setDraftStatements((prev) => {
                            const next = [...(prev ?? [])];
                            next[i] = el.value;
                            return next;
                          });
                        }}
                        rows={1}
                        className="w-full resize-none overflow-hidden rounded-md border border-gray-200 bg-white p-2 font-mono text-xs leading-relaxed text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                        aria-label={`Policy statement ${i + 1}`}
                      />
                      {statementResult && statementResult.findings.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1">
                          {statementResult.findings.map((finding, fi) => {
                            const isWarning = finding.severity.toUpperCase() === "WARNING";
                            return (
                              <li
                                key={fi}
                                className={`rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed ${
                                  isWarning
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-red-200 bg-red-50 text-red-700"
                                }`}
                              >
                                <span className="font-semibold uppercase">{finding.severity}</span>
                                {finding.found ? (
                                  <>
                                    {" · "}
                                    <span className="font-mono">{finding.found}</span>
                                  </>
                                ) : null}
                                {": "}
                                {finding.message}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Editing here creates a new draft version. Submit the draft for approval to enforce these changes.
              </p>

              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Change label
                </label>
                <input
                  type="text"
                  value={changeLabel}
                  onChange={(e) => setChangeLabel(e.target.value)}
                  placeholder="e.g. Risk scope update"
                  className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              {saveDraftError && (
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {saveDraftError}
                </p>
              )}

              {saveDraftSuccess && (
                <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                  Draft saved successfully.
                </p>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => { setShowEditor(false); setDraftStatements(null); setValidationResult(null); setValidationError(null); setChangeLabel(""); setSaveDraftError(null); setSaveDraftSuccess(false); }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isValidatingSyntax}
                onClick={async () => {
                  setValidationError(null);
                  setValidationResult(null);
                  setIsValidatingSyntax(true);
                  try {
                    const policyText = (draftStatements ?? []).join("\n");
                    const result = await validatePolicySyntax(policyText);
                    setValidationResult(result);
                  } catch (err) {
                    setValidationError(
                      err instanceof Error ? err.message : "Failed to validate policy syntax."
                    );
                  } finally {
                    setIsValidatingSyntax(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isValidatingSyntax && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Validate syntax
              </button>
              <button
                type="button"
                disabled={isSavingDraft}
                onClick={async () => {
                  setSaveDraftError(null);
                  setSaveDraftSuccess(false);

                  if (!policy.uid) {
                    setSaveDraftError("No policy identifier available to save a draft.");
                    return;
                  }
                  if (!changeLabel.trim()) {
                    setSaveDraftError("Change label is required.");
                    return;
                  }

                  setIsSavingDraft(true);
                  try {
                    await savePolicyDraft(policy.uid, {
                      name: policy.name,
                      description: policy.description,
                      compartmentId: policy.compartmentId ?? "",
                      statements: draftStatements ?? [],
                      changeLabel: changeLabel.trim(),
                    });
                    setSaveDraftSuccess(true);
                  } catch (err) {
                    setSaveDraftError(
                      err instanceof Error ? err.message : "Failed to save draft."
                    );
                  } finally {
                    setIsSavingDraft(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDraft && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Save draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex border-b border-gray-200 bg-white px-1 pt-1 rounded-t-lg border border-blue-100 border-b-0 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        className={`rounded-b-lg border border-t-0 border-blue-100 bg-white shadow-sm ${
          activeTab === "statements" ? "" : "p-5"
        }`}
        role="tabpanel"
      >
        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[1.5fr_0.85fr]">
            {/* Graph */}
            <div className="flex flex-col">
              <h2 className="mb-3 text-sm font-semibold text-blue-900">
                Policy relationship graph
              </h2>
              <div className="min-h-[430px] flex-1 flex flex-col overflow-hidden rounded-lg border border-blue-100">
                <OciPolicyGraphView
                  graph={graphData?.graph}
                  isLoading={graphLoading}
                  isError={graphIsError}
                  error={graphError}
                  policyFilter={policyName}
                  onPolicyFilterChange={() => {}}
                  statementLimit={graphData?.graph?.meta.statementLimit ?? 100}
                  onStatementLimitChange={() => {}}
                  policyNames={[policyName]}
                  lockPolicyFilter
                  hideStatementLimit
                />
              </div>
            </div>

            {/* Right column: posture + info */}
            <div className="flex flex-col justify-between gap-5">
              {/* Posture metrics */}
              <div className="w-full">
                <h2 className="mb-3 text-sm font-semibold text-blue-900">Policy posture</h2>
                <div className="grid w-full grid-cols-2 gap-2.5">
                  {[
                    { label: "Statements", value: String(policy.statementCount), cls: "text-gray-900" },
                    { label: "Critical resources", value: String(criticalResources || "—"), cls: criticalResources > 0 ? "text-red-600" : "text-gray-900" },
                    { label: "Subjects", value: String(subjectCount || "—"), cls: "text-gray-900" },
                    { label: "Resources", value: String(distinctResources || "—"), cls: "text-gray-900" },
                    { label: "Conditions", value: String(conditionCount), cls: "text-gray-900" },
                    { label: "Compartments", value: String(compartmentCount), cls: "text-gray-900" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className={`text-lg font-bold ${m.cls}`}>{m.value}</div>
                      <div className="mt-0.5 text-[11px] text-gray-500">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy info */}
              <div className="w-full">
                <h2 className="mb-3 text-sm font-semibold text-blue-900">Policy information</h2>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "Created by", value: policy.createdBy || "—" },
                    { label: "Created on", value: formatDate(policy.createdOn) },
                    { label: "Last modified", value: formatDate(policy.lastModified) },
                    { label: "Last synchronized", value: formatDate(policy.lastSync) },
                    { label: "Owner", value: policy.owner || "—" },
                  ].map((info) => (
                    <div key={info.label} className="rounded-lg border border-gray-200 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {info.label}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-gray-800 [overflow-wrap:anywhere]">
                        {info.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STATEMENTS ── */}
        {activeTab === "statements" && (
          <div>
            {/* Toggle */}
            <div className="mb-4 flex justify-center">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              {(["full", "statement"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setStatementsView(view)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    statementsView === view
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {view === "full" ? "Full View" : "Statement View"}
                </button>
              ))}
            </div>
            </div>

            {statementsView === "full" && (
              <PolicyStatementsPanel
                policyName={policy.name}
                statements={statements}
                isLoading={listLoading}
                selectedStatementIndex={selectedStatementIndex}
                onStatementClick={handleStatementClick}
                hideStatementColumn
              />
            )}

            {statementsView === "statement" && (
              <PolicyStatementsPanel
                policyName={policy.name}
                statements={statements}
                isLoading={listLoading}
                selectedStatementIndex={selectedStatementIndex}
                onStatementClick={handleStatementClick}
                statementOnlyMode
              />
            )}
          </div>
        )}

        {/* ── IMPACT ANALYSIS ── */}
        {activeTab === "impact" && (
          <ImpactAnalysisPanel policyName={policy.name} policyUid={policy.uid} />
        )}

        {/* ── VERSIONS ── */}
        {activeTab === "versions" && (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-blue-900">Version history</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Showing available version data from the API.
                </p>
              </div>
            </div>

            {restoreVersionError && (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {restoreVersionError}
              </p>
            )}
            {restoreVersionSuccess && (
              <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {restoreVersionSuccess}
              </p>
            )}
            {impactAnalysisError && (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {impactAnalysisError}
              </p>
            )}
            {impactAnalysisSuccess && (
              <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {impactAnalysisSuccess}
              </p>
            )}

            {!policy.uid ? (
              <p className="text-sm text-gray-400">
                No policy identifier available to look up version history.
              </p>
            ) : activityLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading versions…
              </div>
            ) : activityIsError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {activityError instanceof Error ? activityError.message : "Failed to load policy versions."}
              </p>
            ) : policyVersions.length === 0 ? (
              <p className="text-sm text-gray-400">No versions recorded for this policy.</p>
            ) : (
            <>
            <div className="overflow-x-auto rounded-lg border border-blue-100">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Version", "Status", "Created", "Enforced", "Created by", "Impact Analysis", "Actions"].map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-blue-100 bg-blue-50/80 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                        {h}
                      </th>
                    ))}
                    <th className="border-b border-blue-100 bg-blue-50/80 px-3 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {policyVersions.map((ver) => {
                    const statusLower = (ver.status ?? "").toLowerCase();
                    const isDraft = statusLower.includes("draft");
                    const isSuperseded = statusLower.includes("supersed");
                    const isCurrent = statusLower.includes("active") || statusLower.includes("enforced");
                    const expanded = expandedVersions.has(ver.id);
                    const label = ver.versionNo != null ? `v${ver.versionNo}` : ver.status ?? "—";

                    const versionNo = ver.versionNo;
                    const isRestoring = restoringVersionId === ver.id;

                    const handleCreateAsDraft = async () => {
                      setRestoreVersionError(null);
                      setRestoreVersionSuccess(null);

                      if (!policy.uid) {
                        setRestoreVersionError("No policy identifier available to restore this version.");
                        return;
                      }
                      if (versionNo == null) {
                        setRestoreVersionError(`Unable to determine version number for ${label}.`);
                        return;
                      }

                      setRestoringVersionId(ver.id);
                      try {
                        await restorePolicyVersion(policy.uid, versionNo);
                        setRestoreVersionSuccess(`${label} was restored as a new draft.`);
                      } catch (err) {
                        setRestoreVersionError(
                          err instanceof Error ? err.message : `Failed to restore ${label} as a draft.`
                        );
                      } finally {
                        setRestoringVersionId(null);
                      }
                    };

                    const isRunningImpactAnalysis = runningImpactVersionId === ver.id;

                    const handleRunImpactAnalysis = async () => {
                      setImpactAnalysisError(null);
                      setImpactAnalysisSuccess(null);

                      if (!policy.uid) {
                        setImpactAnalysisError("No policy identifier available to run impact analysis.");
                        return;
                      }

                      setRunningImpactVersionId(ver.id);
                      try {
                        await runPolicyImpactAnalysis(policy.uid);
                        setImpactAnalysisSuccess(`Impact analysis started for ${label}.`);
                      } catch (err) {
                        setImpactAnalysisError(
                          err instanceof Error
                            ? err.message
                            : `Failed to run impact analysis for ${label}.`
                        );
                      } finally {
                        setRunningImpactVersionId(null);
                      }
                    };

                    const actions: {
                      label: string;
                      icon: React.ElementType;
                      bg: string;
                      fg: string;
                      onClick?: () => void;
                      disabled?: boolean;
                      loading?: boolean;
                    }[] = [
                      ...(isDraft     ? [{ label: "Edit",                icon: FilePen,       bg: "bg-blue-100",   fg: "text-blue-600" }]   : []),
                      ...(isSuperseded? [{ label: "View",                icon: Eye,           bg: "bg-indigo-100", fg: "text-indigo-600" }] : []),
                      ...(isSuperseded? [{
                        label: "Create as Draft",
                        icon: Copy,
                        bg: "bg-teal-100",
                        fg: "text-teal-600",
                        onClick: handleCreateAsDraft,
                        disabled: isRestoring,
                        loading: isRestoring,
                      }]   : []),
                      ...(isDraft     ? [{ label: "Submit for Approval", icon: SendHorizonal, bg: "bg-green-100",  fg: "text-green-600" }]  : []),
                      ...(isDraft     ? [{
                        label: "Run Impact Analysis",
                        icon: Activity,
                        bg: "bg-purple-100",
                        fg: "text-purple-600",
                        onClick: handleRunImpactAnalysis,
                        disabled: isRunningImpactAnalysis,
                        loading: isRunningImpactAnalysis,
                      }] : []),
                      ...(isDraft     ? [{ label: "Delete",              icon: Trash2,        bg: "bg-red-100",    fg: "text-red-600" }]    : []),
                    ];

                    const statusBadge =
                      statusLower.includes("draft")   ? "bg-orange-100 text-orange-700"   :
                      statusLower.includes("pending") ? "bg-sky-100 text-sky-700"         :
                      statusLower.includes("reject")  ? "bg-rose-100 text-rose-700"       :
                      isCurrent                       ? "bg-emerald-100 text-emerald-700" :
                                                         "bg-slate-100 text-slate-600";

                    const impactLower = (ver.impactStatus ?? "").toLowerCase();
                    const impactBadge =
                      impactLower.includes("complet")  ? "bg-teal-100 text-teal-700"     :
                      impactLower.includes("progress") ? "bg-violet-100 text-violet-700" :
                      impactLower.includes("fail")     ? "bg-red-100 text-red-700"       :
                      impactLower.includes("outdat")   ? "bg-yellow-100 text-yellow-700" :
                                                          "bg-gray-100 text-gray-500";

                    return (
                      <React.Fragment key={ver.id}>
                        <tr className={`border-b border-gray-100 ${!isCurrent ? "cursor-pointer hover:bg-slate-50" : ""}`}
                          onClick={() => { if (!isCurrent) toggleVersion(ver.id); }}
                        >
                          <td className="px-3 py-3 font-medium text-gray-900">{label}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge}`}>
                              {ver.status || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-600">{formatDate(ver.createdAt)}</td>
                          <td className="px-3 py-3 text-gray-600">{formatDate(ver.enforcedAt)}</td>
                          <td className="px-3 py-3 text-gray-700">{ver.changedBy || "—"}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${impactBadge}`}>
                              {ver.impactStatus || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {actions.map((a) => (
                                <button
                                  key={a.label}
                                  type="button"
                                  title={a.label}
                                  disabled={a.disabled}
                                  onClick={a.onClick}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-80 ${a.bg} ${a.fg} ${
                                    a.disabled ? "cursor-not-allowed opacity-50" : ""
                                  }`}
                                >
                                  {a.loading ? (
                                    <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                                  ) : (
                                    <a.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {!isCurrent && (
                              <button type="button" onClick={() => toggleVersion(ver.id)}>
                                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <td colSpan={8} className="px-6 py-3">
                              <div className="flex flex-col border-l-2 border-blue-200">
                                {statements.length === 0 ? (
                                  <p className="pl-4 text-xs text-gray-400">No statements available.</p>
                                ) : (
                                  statements.map((s, i) => (
                                    <div key={`${ver.id}-s-${i}`} className={`px-4 py-2 font-mono text-sm text-gray-700 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                                      {s.text}
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Full version history requires KeyForge version tracking to be enabled for this policy.
            </p>
            </>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === "activity" && (
          <div>
            <h2 className="mb-4 text-sm font-semibold text-blue-900">Policy activity</h2>

            {!policy.uid ? (
              <p className="text-sm text-gray-400">
                No policy identifier available to look up activity history.
              </p>
            ) : activityLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading activity…
              </div>
            ) : activityIsError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {activityError instanceof Error
                  ? activityError.message
                  : "Failed to load policy activity."}
              </p>
            ) : !activityData?.events.length ? (
              <p className="text-sm text-gray-400">No activity recorded for this policy.</p>
            ) : (
              <div className="relative ml-3 border-l-2 border-gray-200 pl-6">
                {activityData.events.map((item) => (
                  <div key={item.id} className="relative mb-5">
                    <div className="absolute -left-[1.625rem] top-1 h-3.5 w-3.5 rounded-full border-2 border-blue-400 bg-white" />
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{item.event}</p>
                      {item.versionNo != null && (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                          v{item.versionNo}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.changedBy || "—"} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
