"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, AlertTriangle, FileText, CheckCircle2, Undo2, Scale } from "lucide-react";
import sodViolations from "@/public/SodVoilations.json";
import sodPolicies from "@/public/SODPolicy.json";
import sodRules from "@/public/SOdRules.json";
import ruleEntitlementRows from "@/public/RuleEntitlement.json";
import mitigatingControlCatalog from "@/public/MitigatingControl.json";
import { useAuth } from "@/contexts/AuthContext";
import { getReviewerId } from "@/lib/auth";

type Violation = (typeof sodViolations)[number];
type MitigatingControlCatalogRow = (typeof mitigatingControlCatalog)[number];

/** Renders `id` in bold and `name` in normal weight (e.g. **R3** — Payment Release). */
function IdNameLine({
  id,
  name,
  className = "",
  idClassName = "font-bold",
  nameClassName = "font-normal",
}: {
  id: string;
  name: string;
  className?: string;
  idClassName?: string;
  nameClassName?: string;
}) {
  const idTrim = String(id ?? "").trim();
  const nameTrim = String(name ?? "").trim();
  if (!idTrim && !nameTrim) {
    return <span className={className}>—</span>;
  }
  if (idTrim && !nameTrim) {
    return <span className={`${idClassName} ${className}`.trim()}>{idTrim}</span>;
  }
  if (!idTrim && nameTrim) {
    return <span className={`${nameClassName} ${className}`.trim()}>{nameTrim}</span>;
  }
  return (
    <span className={`inline min-w-0 break-words ${className}`.trim()}>
      <span className={idClassName}>{idTrim}</span>
      <span className={nameClassName}>{" — "}{nameTrim}</span>
    </span>
  );
}

export default function SodViolationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const ccFromSource = useMemo(() => {
    if (searchParams.get("source") !== "continuous-compliance") return null;
    return {
      entity: searchParams.get("ccEntity") ?? "",
      details: searchParams.get("ccDetails") ?? "",
      triggerEvent: searchParams.get("ccTriggerEvent") ?? "",
      actionType: searchParams.get("ccActionType") ?? "",
      dueOn: searchParams.get("ccDueOn") ?? "",
      assignedTo: searchParams.get("ccAssignedTo") ?? "",
    };
  }, [searchParams]);

  const violation: Violation | undefined = useMemo(
    () => (Array.isArray(sodViolations) ? sodViolations.find((v) => v.Violation_ID === id) : undefined),
    [id]
  );

  const policy = useMemo(
    () =>
      Array.isArray(sodPolicies) && violation
        ? sodPolicies.find((p) => p.Policy_ID === violation.Policy_ID)
        : undefined,
    [violation]
  );

  const masterRule = useMemo(() => {
    if (!Array.isArray(sodRules) || !violation) return undefined;
    const id = String(violation.Master_Rule ?? "").trim();
    return sodRules.find((r) => String(r.Rule_ID ?? "").trim() === id);
  }, [violation]);

  const conflictingRule = useMemo(() => {
    if (!Array.isArray(sodRules) || !violation) return undefined;
    const id = String(violation.Conflicting_Rule ?? "").trim();
    return sodRules.find((r) => String(r.Rule_ID ?? "").trim() === id);
  }, [violation]);

  /** Application for this rule + entitlement (from RuleEntitlement.json). */
  const masterApplicationName = useMemo(() => {
    if (!violation || !Array.isArray(ruleEntitlementRows)) return "N/A";
    const rid = String(violation.Master_Rule ?? "").trim();
    const ent = violation["Master_Entitlement"];
    const row = ruleEntitlementRows.find(
      (r: { Rule_ID: string; Entitlement_Name: string; Application?: string }) =>
        String(r.Rule_ID).trim() === rid && r.Entitlement_Name === ent
    );
    return row?.Application?.trim() || "N/A";
  }, [violation]);

  const conflictingApplicationName = useMemo(() => {
    if (!violation || !Array.isArray(ruleEntitlementRows)) return "N/A";
    const rid = String(violation.Conflicting_Rule ?? "").trim();
    const ent = violation["Conflicting_Entitlement"];
    const row = ruleEntitlementRows.find(
      (r: { Rule_ID: string; Entitlement_Name: string; Application?: string }) =>
        String(r.Rule_ID).trim() === rid && r.Entitlement_Name === ent
    );
    return row?.Application?.trim() || "N/A";
  }, [violation]);

  const policyIdName = useMemo(() => {
    if (!violation) return { id: "", name: "" };
    return {
      id: String(violation.Policy_ID ?? "").trim(),
      name: String(policy?.Policy_Name ?? violation.SOD_Policy_Name ?? "").trim(),
    };
  }, [violation, policy]);

  const masterRuleParts = useMemo(() => {
    if (!violation) return { id: "", name: "" };
    return {
      id: String(violation.Master_Rule ?? "").trim(),
      name: String(masterRule?.Rule_Name ?? "").trim(),
    };
  }, [violation, masterRule]);

  const conflictingRuleParts = useMemo(() => {
    if (!violation) return { id: "", name: "" };
    return {
      id: String(violation.Conflicting_Rule ?? "").trim(),
      name: String(conflictingRule?.Rule_Name ?? "").trim(),
    };
  }, [violation, conflictingRule]);

  const masterBpParts = useMemo(
    () => ({
      id: String(masterRule?.["Business Process ID"] ?? "").trim(),
      name: String(masterRule?.["Business Process Name"] ?? "").trim(),
    }),
    [masterRule]
  );

  const conflictingBpParts = useMemo(
    () => ({
      id: String(conflictingRule?.["Business Process ID"] ?? "").trim(),
      name: String(conflictingRule?.["Business Process Name"] ?? "").trim(),
    }),
    [conflictingRule]
  );

  const mitigatingControls = useMemo(() => {
    if (!policy || !policy["Mitigating Control ID"]) return [];
    const catalogMap = new Map(
      (Array.isArray(mitigatingControlCatalog) ? mitigatingControlCatalog : []).map(
        (row: MitigatingControlCatalogRow) => [
          String(row["Control ID"] ?? "").trim(),
          String(row.Name ?? "").trim(),
        ]
      )
    );

    return String(policy["Mitigating Control ID"])
      .split("\n")
      .map((controlId: string) => {
        const id = controlId.trim();
        if (!id) return null;
        return {
          id,
          name: catalogMap.get(id) || "",
        };
      })
      .filter((mc): mc is { id: string; name: string } => Boolean(mc));
  }, [policy]);

  const [activeTab, setActiveTab] = useState<"accept" | "remediate" | "mitigate">("accept");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [remediateComment, setRemediateComment] = useState("");
  const canRevokeSave = remediateComment.trim().length > 0;

  // Avatar state: try the shared user image pool first, then fall back to initials.
  const [avatarErrorIndexByKey, setAvatarErrorIndexByKey] = useState<Record<string, number>>(
    {}
  );

  const getUserKey = (v: Violation) => String(v.Username || v.Identity || v.Violation_ID || "");
  const getAvatarCandidates = () => [
    // Prefer a different avatar pool than the shared /User.jpg.
    "/pictures/user_image4.avif",
    "/pictures/user_image1.avif",
    "/pictures/user_image7.avif",
    "/pictures/user_image8.avif",
    "/User.jpg",
  ];
  const getInitials = (name: string) => {
    const parts = String(name || "").split(" ").filter(Boolean);
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    return initials.substring(0, 2) || "U";
  };

  if (!violation) {
    const backToContinuousCompliance =
      searchParams.get("source") === "continuous-compliance";
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-5xl mx-auto py-8 px-4">
          <button
            type="button"
            onClick={() =>
              backToContinuousCompliance
                ? router.push("/campaigns/continuous-compliance")
                : router.back()
            }
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {backToContinuousCompliance ? "Back to Continuous Compliance" : "Back"}
          </button>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-sm text-gray-700">Violation not found.</p>
          </div>
        </div>
      </div>
    );
  }

  const displayIdentity =
    ccFromSource?.details?.trim() || violation.Identity;
  const displayUsername =
    ccFromSource?.details?.trim() || violation.Username;

  const masterEntitlement = violation["Master_Entitlement"];
  const conflictingEntitlement = violation["Conflicting_Entitlement"];
  const loggedIn = user as any;
  const managerName =
    loggedIn?.email ||
    loggedIn?.userid ||
    loggedIn?.userId ||
    getReviewerId() ||
    (violation as any)?.Manager ||
    (violation as any)?.manager ||
    (violation as any)?.["Manager Name"] ||
    "Unknown";

  const riskLevel = String(violation.Risk_Level || "");
  const isHighRisk = riskLevel.toLowerCase() === "high";
  const riskBadgeClasses = isHighRisk
    ? "bg-amber-50 border-amber-100 text-amber-800"
    : "bg-red-50 border-red-100 text-red-800";
  const riskBorderClasses = isHighRisk ? "border-amber-100" : "border-red-100";

  /** Policy description: violation row first, then SOD policy catalog (mapped fields). */
  const policyDescriptionMapped =
    String(violation["SOD Policy Description"] ?? "").trim() ||
    String(policy?.Description ?? "").trim() ||
    "";

  /** Rule statement description: only actual description fields from the rule (not Rule_Name). */
  const mapRuleDescription = (rule: (typeof sodRules)[number] | undefined) => {
    if (!rule) return "No description captured for this rule.";
    const r = rule as Record<string, unknown>;
    const fromRule =
      String(r.Description ?? r.description ?? r.Rule_Description ?? "").trim();
    return fromRule || "No description captured for this rule.";
  };

  const masterRuleDescriptionMapped = mapRuleDescription(masterRule);
  const conflictingRuleDescriptionMapped = mapRuleDescription(conflictingRule);

  const showSavedToast = (message: string) => {
    setToastMessage(message);
    // Clear the message after a short delay.
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-6xl mx-auto py-8 px-4 space-y-6">
        {/* User card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-6">
            <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {(() => {
                const userKey = getUserKey({
                  ...violation,
                  Identity: displayIdentity,
                  Username: displayUsername,
                } as Violation);
                const candidates = getAvatarCandidates();
                const index = Math.max(0, avatarErrorIndexByKey[userKey] ?? 0);
                const src = candidates[Math.min(index, candidates.length - 1)];

                if (!src || index >= candidates.length - 1) {
                  return (
                    <span className="text-sm font-semibold text-white bg-gray-400 w-full h-full flex items-center justify-center">
                      {getInitials(displayIdentity)}
                    </span>
                  );
                }

                return (
                  <Image
                    src={src}
                    alt={`Profile picture of ${displayIdentity}`}
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized={true}
                    loading="lazy"
                    onError={() => {
                      setAvatarErrorIndexByKey((prev) => {
                        const currentIndex = prev[userKey] ?? 0;
                        const nextIndex = Math.min(currentIndex + 1, candidates.length - 1);
                        return { ...prev, [userKey]: nextIndex };
                      });
                    }}
                  />
                );
              })()}
            </div>

            <div className="flex-1 min-w-0">
              {/* Identity row (left in screenshot) */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" aria-hidden />
                <div className="text-sm md:text-base font-semibold text-gray-900 truncate">
                  {displayIdentity}
                </div>
              </div>

              {/* Job Title / Manager / Department row */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" aria-hidden />
                  <span className="text-xs text-gray-500 shrink-0">Job Title:</span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 truncate">
                    {violation["Job Title"]}
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shrink-0" aria-hidden />
                  <span className="text-xs text-gray-500 shrink-0">Manager:</span>
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 truncate">
                    {managerName}
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500 shrink-0" aria-hidden />
                  <span className="text-xs text-gray-500 shrink-0">Department:</span>
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800 truncate">
                    {violation.Department}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${riskBadgeClasses} ${riskBorderClasses}`}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {violation.Risk_Level} Risk
              </span>
              <span className="text-[11px] text-gray-500">
                Detected {violation["Detection Date"]}
              </span>
            </div>
          </div>

          {ccFromSource && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800">
                  Continuous Compliance — source event
                </p>
                <Link
                  href="/campaigns/continuous-compliance"
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                >
                  Back to queue
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                {[
                  ["Entity", ccFromSource.entity],
                  ["Details", ccFromSource.details],
                  ["Trigger event", ccFromSource.triggerEvent],
                  ["Review / action type", ccFromSource.actionType],
                  ["Due / expires on", ccFromSource.dueOn],
                  ["Assigned to", ccFromSource.assignedTo],
                ]
                  .filter(([, v]) => String(v ?? "").trim().length > 0)
                  .map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        {label}
                      </div>
                      <div className="mt-0.5 text-gray-900 break-words">{value}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* SoD Policy details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">SoD Policy Details</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Policy metadata and risk classification.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200">
                <span className="shrink-0">Policy:</span>
                <IdNameLine {...policyIdName} className="text-gray-900" />
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${riskBadgeClasses} ${riskBorderClasses}`}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {violation.Risk_Level} Risk
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Policy</div>
              <div className="mt-1 text-sm text-gray-900 break-words">
                <IdNameLine {...policyIdName} />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Master Rule</div>
              <div className="mt-1 text-sm text-gray-900 break-words">
                <IdNameLine {...masterRuleParts} />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Conflicting Rule</div>
              <div className="mt-1 text-sm text-gray-900 break-words">
                <IdNameLine {...conflictingRuleParts} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3">
            <div className="text-[11px] font-medium text-emerald-700 uppercase">Description</div>
            <div className="mt-1 text-sm text-gray-700 leading-relaxed">
              {policyDescriptionMapped || "No description available."}
            </div>
          </div>
        </div>

        {/* Master statement details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Master Statement Details</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  The primary statement contributing to this SoD conflict.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200">
                <span className="shrink-0">Rule:</span>
                <IdNameLine {...masterRuleParts} className="text-gray-900" />
              </span>
              <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 border border-emerald-100">
                <span className="shrink-0">BP:</span>
                <IdNameLine
                  {...masterBpParts}
                  className="text-emerald-900"
                  idClassName="font-bold text-emerald-900"
                  nameClassName="font-normal text-emerald-900"
                />
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Ent Name</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{masterEntitlement}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Type</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Entitlement</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Application Name</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 break-words">
                {masterApplicationName}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Grant Type</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Policy</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-2">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Business Process</div>
              <div className="mt-1 text-sm text-gray-900 break-words">
                <IdNameLine {...masterBpParts} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3">
            <div className="text-[11px] font-medium text-emerald-700 uppercase">Description</div>
            <div className="mt-1 text-sm text-gray-700 leading-relaxed">
              {masterRuleDescriptionMapped}
            </div>
          </div>
        </div>

        {/* Conflicting statement details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-600" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Conflicting Statement Details</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  The statement that conflicts with the master statement.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200">
                <span className="shrink-0">Rule:</span>
                <IdNameLine {...conflictingRuleParts} className="text-gray-900" />
              </span>
              <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 border border-rose-100">
                <span className="shrink-0">BP:</span>
                <IdNameLine
                  {...conflictingBpParts}
                  className="text-rose-900"
                  idClassName="font-bold text-rose-900"
                  nameClassName="font-normal text-rose-900"
                />
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Ent Name</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{conflictingEntitlement}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Type</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Entitlement</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Application Name</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 break-words">
                {conflictingApplicationName}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Grant Type</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Policy</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-2">
              <div className="text-[11px] font-medium text-gray-500 uppercase">Business Process</div>
              <div className="mt-1 text-sm text-gray-900 break-words">
                <IdNameLine {...conflictingBpParts} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50/40 px-4 py-3">
            <div className="text-[11px] font-medium text-rose-700 uppercase">Description</div>
            <div className="mt-1 text-sm text-gray-700 leading-relaxed">
              {conflictingRuleDescriptionMapped}
            </div>
          </div>
        </div>

        {/* Actions panel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-900">Actions</h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("accept")}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                activeTab === "accept"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Accept Risk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("remediate")}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                activeTab === "remediate"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Remediate
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mitigate")}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                activeTab === "mitigate"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Shield className="w-3 h-3 mr-1" />
              Mitigate
            </button>
          </div>

          <div className="border-t border-gray-200 pt-4">
            {activeTab === "accept" && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      End time
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Evidence URL
                    </label>
                    <input
                      type="url"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Justification
                  </label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Describe why this risk is being accepted..."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                    onClick={() => showSavedToast("Saved accepted risk")}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {activeTab === "remediate" && (
              <div className="space-y-4 text-sm">
                <p className="text-xs text-gray-600">
                  Select which entitlement to revoke and provide remediation comments.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 cursor-pointer">
                    <input type="radio" name="revokeEntitlement" className="mt-1" defaultChecked />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {masterEntitlement}
                      </span>
                      <span className="block text-[11px] text-gray-600 mt-0.5">
                        Master entitlement
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 cursor-pointer">
                    <input type="radio" name="revokeEntitlement" className="mt-1" />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {conflictingEntitlement}
                      </span>
                      <span className="block text-[11px] text-gray-600 mt-0.5">
                        Conflicting entitlement
                      </span>
                    </span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Comments
                  </label>
                  <textarea
                    value={remediateComment}
                    onChange={(e) => setRemediateComment(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Describe remediation steps, approvals, or tickets..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={!canRevokeSave}
                    className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => showSavedToast("Saved remediation")}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {activeTab === "mitigate" && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-700">
                      <span>Mitigating Control</span>
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                        AI
                      </span>
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select a mitigating control
                      </option>
                      {mitigatingControls.map((mc) => (
                        <option key={mc.id} value={mc.id}>
                          {mc.name ? `${mc.id} - ${mc.name}` : mc.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Evidence URL
                    </label>
                    <input
                      type="url"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Justification
                  </label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Describe how this control mitigates the risk..."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                    onClick={() => showSavedToast("Saved mitigation")}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {toastMessage && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm"
            role="status"
            aria-live="polite"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

