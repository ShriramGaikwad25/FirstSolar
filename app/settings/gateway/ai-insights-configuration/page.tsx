"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type InsightOption = {
  key: string;
  label: string;
};

const ACCESS_REVIEW_OPTIONS: InsightOption[] = [
  { key: "accessAssignmentHistory", label: "Access Assignment History" },
  { key: "peerAnalysis", label: "Peer Analysis" },
  { key: "policyViolation", label: "Policy Violation" },
  { key: "lastAccessReviewAction", label: "Last Access Review Action" },
  { key: "accessSensitivityRisk", label: "Access Sensitivity Risk" },
  { key: "sixMonthHistory", label: "Six Month History" },
];

const ACCESS_APPROVAL_OPTIONS: InsightOption[] = [
  { key: "beneficiaryAnalysis", label: "Beneficiary Analysis" },
  { key: "contextualRisk", label: "Contextual Risk" },
  { key: "accessSensitivityAnalysis", label: "Access Sensitivity Analysis" },
  { key: "peerAnalyis", label: "Peer Analyis" },
];

function InsightsSectionCard({
  title,
  options,
  selected,
  onToggle,
  onSave,
  expanded,
  onExpandToggle,
}: {
  title: string;
  options: InsightOption[];
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
  onSave: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
}) {
  const sectionId = title.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="border border-gray-200 rounded-xl shadow-sm bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
        onClick={onExpandToggle}
        aria-expanded={expanded ? "true" : "false"}
        aria-controls={`section-${sectionId}`}
      >
        <h2 className="text-lg font-semibold text-gray-900 text-left">{title}</h2>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {expanded && (
        <div id={`section-${sectionId}`} className="p-5 border-t border-gray-100">
          <div className="space-y-3">
            {options.map((option) => (
              <label key={option.key} className="flex items-center gap-3 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={!!selected[option.key]}
                  onChange={() => onToggle(option.key)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              aria-label={`Save ${title}`}
              id={`save-${sectionId}`}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildInitialExpandedState(): Record<string, boolean> {
  return {
    accessReview: false,
    accessApproval: false,
  };
}

function toggleExpandedSection(
  current: Record<string, boolean>,
  key: keyof ReturnType<typeof buildInitialExpandedState>
): Record<string, boolean> {
  return {
    ...current,
    [key]: !current[key],
  };
}

function buildInitialSelection(options: InsightOption[]): Record<string, boolean> {
  return options.reduce<Record<string, boolean>>((acc, option) => {
    acc[option.key] = true;
    return acc;
  }, {});
}

function toggleSelection(
  current: Record<string, boolean>,
  key: string
): Record<string, boolean> {
  return {
    ...current,
    [key]: !current[key],
  };
}

export default function AiInsightsConfigurationPage() {
  const [accessReviewSelection, setAccessReviewSelection] = useState<Record<string, boolean>>(
    () => buildInitialSelection(ACCESS_REVIEW_OPTIONS)
  );
  const [accessApprovalSelection, setAccessApprovalSelection] = useState<Record<string, boolean>>(
    () => buildInitialSelection(ACCESS_APPROVAL_OPTIONS)
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    buildInitialExpandedState
  );

  const handleAccessReviewSave = () => {
    alert("Access Review Insights saved successfully.");
  };

  const handleAccessApprovalSave = () => {
    alert("Access Approval Insights saved successfully.");
  };

  return (
    <div className="h-full p-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">AI Insights Configuration</h1>
        <div className="space-y-6">
          <InsightsSectionCard
            title="Access Review Insights"
            options={ACCESS_REVIEW_OPTIONS}
            selected={accessReviewSelection}
            onToggle={(key) =>
              setAccessReviewSelection((prev) => toggleSelection(prev, key))
            }
            onSave={handleAccessReviewSave}
            expanded={!!expandedSections.accessReview}
            onExpandToggle={() =>
              setExpandedSections((prev) =>
                toggleExpandedSection(prev, "accessReview")
              )
            }
          />
          <InsightsSectionCard
            title="Access Approval Insights"
            options={ACCESS_APPROVAL_OPTIONS}
            selected={accessApprovalSelection}
            onToggle={(key) =>
              setAccessApprovalSelection((prev) => toggleSelection(prev, key))
            }
            onSave={handleAccessApprovalSave}
            expanded={!!expandedSections.accessApproval}
            onExpandToggle={() =>
              setExpandedSections((prev) =>
                toggleExpandedSection(prev, "accessApproval")
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

