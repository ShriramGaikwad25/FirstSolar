"use client";

import React from "react";
import ActionButtons from "@/components/agTable/ActionButtons";

/** Shape of one entry from aiassist.kf_insights[] */
export interface KfInsight {
  request_history?: { value?: string } | string;
  compliance_violation?: { value?: string } | Record<string, never>;
  peer_analysis?: unknown[];
  latest_decision?: {
    value?: string;
    comments?: string;
    campaign?: string;
    reviewer?: string;
    reviewed_on?: string;
    status?: string;
  };
  risk_assessment?: {
    reason?: string;
    overall_risk?: string;
    details?: {
      metadata?: Record<string, string | null | Record<string, string>>;
      entitlement_risk_level?: string | null;
      high_privilege_signals?: string[];
    };
  };
  six_month_history?: {
    value?: string;
    approved_count?: number;
    revoked_count?: number;
  };
  [key: string]: unknown;
}

export interface TaskSummaryPanelProps {
  headerLeft: {
    primary: string;
    secondary: string;
  };
  headerRight: {
    primary: string;
    secondary: string;
  };
  riskLabel?: string;
  jobTitle?: string;
  applicationName?: string;
  reviewerId: string;
  certId: string;
  selectedRow?: any;
  onActionSuccess?: () => void;
}

function formatReviewDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** API often sends `{ value: "..." }`; support legacy plain strings. */
function insightTextField(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? t : null;
  }
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    const v = (raw as { value?: unknown }).value;
    if (typeof v === "string") {
      const t = v.trim();
      return t ? t : null;
    }
  }
  return null;
}

function getLatestDecisionDisplay(insight: KfInsight): string | null {
  const ld = insight.latest_decision;
  if (!ld || typeof ld !== "object") return null;
  if ("value" in ld && typeof (ld as { value?: unknown }).value === "string") {
    const t = (ld as { value: string }).value.trim();
    if (t) return t;
  }
  const o = ld as {
    status?: string;
    reviewed_on?: string;
    reviewer?: string;
    comments?: string;
    campaign?: string;
  };
  if (o.status || o.reviewed_on || o.reviewer || o.comments || o.campaign) {
    return `Access "${capitalize(o.status ?? "")}" on "${formatReviewDate(o.reviewed_on)}" by "${o.reviewer ?? ""}" with comments - "${o.comments ?? ""}" as part of access review campaign - "${o.campaign ?? ""}"`;
  }
  return null;
}

function getSixMonthHistoryDisplay(insight: KfInsight): string | null {
  const smh = insight.six_month_history;
  if (smh == null || typeof smh !== "object") return null;
  const fromValue = insightTextField(smh);
  if (fromValue) return fromValue;
  const o = smh as { approved_count?: number; revoked_count?: number };
  if (o.approved_count != null || o.revoked_count != null) {
    return `This item was Approved ${o.approved_count ?? 0} times, Revoked ${o.revoked_count ?? 0} times in the last 6 months.`;
  }
  return null;
}

function hasRiskAssessmentContent(ra: NonNullable<KfInsight["risk_assessment"]>): boolean {
  if (ra.reason?.trim()) return true;
  if (ra.overall_risk?.trim()) return true;
  const d = ra.details;
  if (!d) return false;
  if (d.entitlement_risk_level != null && String(d.entitlement_risk_level).trim() !== "") return true;
  if (d.high_privilege_signals && d.high_privilege_signals.length > 0) return true;
  if (d.metadata && typeof d.metadata === "object") {
    for (const v of Object.values(d.metadata)) {
      if (v == null || v === "") continue;
      if (typeof v === "object" && v !== null && Object.keys(v as object).length > 0) return true;
      if (typeof v === "string") return true;
    }
  }
  return false;
}

const TaskSummaryPanel: React.FC<TaskSummaryPanelProps> = ({
  headerLeft,
  headerRight,
  applicationName,
  reviewerId,
  certId,
  selectedRow,
  onActionSuccess,
}) => {
  const insight: KfInsight | undefined = selectedRow?.aiassist?.kf_insights?.[0];
  const requestHistoryText = insight ? insightTextField(insight.request_history) : null;
  const policyViolationText = insight ? insightTextField(insight.compliance_violation) : null;
  const latestDecisionText = insight ? getLatestDecisionDisplay(insight) : null;
  const sixMonthText = insight ? getSixMonthHistoryDisplay(insight) : null;

  return (
    <div className="space-y-2">
      {/* Assignment card (no border) */}
      <div className="rounded bg-blue-50/40 overflow-hidden">
        <div className="flex items-stretch gap-2 p-2 min-w-0">
          <div className="flex-1 min-w-0 rounded bg-gray-50/80 px-1.5 py-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">User</p>
            <p className="text-xs font-semibold text-gray-900 break-words leading-tight">{headerLeft.primary}</p>
            <p className="text-[10px] text-gray-500 truncate">{headerLeft.secondary}</p>
          </div>
          <div className="flex items-center shrink-0 text-gray-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 rounded bg-gray-50/80 px-1.5 py-1">
            {/* <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">IAM role</p> */}
            <p className="text-xs font-semibold text-gray-900 break-words leading-tight">{headerRight.primary}</p>
            <p className="text-[10px] text-gray-500 truncate">{applicationName || headerRight.secondary}</p>
          </div>
        </div>
      </div>

      {/* Access Assignment History (request_history) */}
      <div className="rounded border border-gray-200 border-l-4 border-l-sky-500 bg-sky-50/40 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Access Assignment History</p>
        <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
          {requestHistoryText ?? (
            <span className="italic text-gray-500">No access assignment history available.</span>
          )}
        </p>
      </div>

      {/* Peer Analysis */}
      <div className="rounded border border-gray-200 border-l-4 border-l-indigo-500 bg-indigo-50/40 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Peer Analysis</p>
        <div className="text-xs text-gray-700 space-y-0.5 mt-1">
          {insight && Array.isArray(insight.peer_analysis) && insight.peer_analysis.length > 0 ? (
            insight.peer_analysis.map((entry: any, i: number) => (
              <p key={i}>
                {entry && typeof entry === "object" && "message" in entry
                  ? String(entry.message)
                  : typeof entry === "string"
                    ? entry
                    : String(entry ?? "")}
              </p>
            ))
          ) : (
            <p className="italic text-gray-500">No peer analysis available.</p>
          )}
        </div>
      </div>

      {/* Policy Violation (compliance_violation) */}
      <div className="rounded border border-gray-200 border-l-4 border-l-rose-600 bg-rose-50/50 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-800">Policy Violation</p>
        <p className="text-xs text-gray-800 mt-1 whitespace-pre-wrap">
          {policyViolationText ? (
            policyViolationText
          ) : (
            <span className="italic text-gray-500">
              {insight ? "No policy violations detected." : "No policy violation data available."}
            </span>
          )}
        </p>
      </div>

      {/* Last Access Review Action */}
      <div className="rounded border border-gray-200 border-l-4 border-l-emerald-500 bg-emerald-50/40 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Last Access Review Action (Past Action / Latest Decision)
        </p>
        <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
          {latestDecisionText ? (
            latestDecisionText
          ) : (
            <span className="italic text-gray-500">No last access review action available.</span>
          )}
        </p>
      </div>

      {/* Access Sensitivity Risk Tag (Risk Assessment) */}
      <div className="rounded border border-gray-200 border-l-4 border-l-amber-500 bg-amber-50/40 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          Access Sensitivity Risk Tag (Risk Assessment)
        </p>
        {insight?.risk_assessment && hasRiskAssessmentContent(insight.risk_assessment) ? (
          <div className="text-xs text-gray-700 space-y-0.5 mt-1 font-mono break-words">
            {insight.risk_assessment.reason ? (
              <p className="font-sans text-gray-800">{insight.risk_assessment.reason}</p>
            ) : null}
            {insight.risk_assessment.overall_risk?.trim() ? (
              <p>{capitalize(insight.risk_assessment.overall_risk)} Risk</p>
            ) : null}
            {insight.risk_assessment.details?.metadata &&
              Object.entries(insight.risk_assessment.details.metadata).map(
                ([key, val]) => {
                  const displayVal =
                    val == null
                      ? ""
                      : typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val);
                  return (
                    <p key={key}>
                      {key}: &quot;{displayVal}&quot;
                    </p>
                  );
                }
              )}
            {insight.risk_assessment.details?.entitlement_risk_level != null && (
              <p>entitlement_risk_level: &quot;{insight.risk_assessment.details.entitlement_risk_level}&quot;</p>
            )}
            {insight.risk_assessment.details?.high_privilege_signals &&
              insight.risk_assessment.details.high_privilege_signals.length > 0 && (
                <p>
                  high_privilege_signals: &quot;
                  {insight.risk_assessment.details.high_privilege_signals.join("; ")}&quot;
                </p>
              )}
          </div>
        ) : (
          <p className="text-xs mt-1 italic text-gray-500">No risk assessment details available.</p>
        )}
      </div>

      {/* Six Month History */}
      <div className="rounded border border-gray-200 border-l-4 border-l-violet-500 bg-violet-50/40 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Six Month History</p>
        <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
          {sixMonthText ? (
            sixMonthText
          ) : (
            <span className="italic text-gray-500">No six month history available.</span>
          )}
        </p>
      </div>

      {/* Decision & actions */}
      <div className="rounded border border-gray-200 border-l-4 border-l-blue-600 bg-blue-50/50 p-2">
        <h3 className="text-xs font-semibold text-gray-800">Should this user have this access?</h3>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <ActionButtons
            api={{} as any}
            selectedRows={selectedRow ? [selectedRow] : []}
            context="entitlement"
            reviewerId={reviewerId}
            certId={certId}
            onActionSuccess={onActionSuccess}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskSummaryPanel;


