"use client";

import { ChevronDown, ChevronUp, Info, Briefcase, Cpu, ShieldCheck, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatDateMMDDYY } from "@/utils/utils";

function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export type EntitlementDetailsSidebarProps = {
  data: any;
  errorMessage: string | null;
  editModeInitial: boolean;
  onSave: (edited: any) => void;
  onClose: () => void;
};

type FramesState = {
  general: boolean;
  business: boolean;
  technical: boolean;
  security: boolean;
  lifecycle: boolean;
};

function formatDate(date: string | undefined) {
  return date ? formatDateMMDDYY(date) || "N/A" : "N/A";
}

function pickValue(record: any, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

export default function EntitlementDetailsSidebar({
  data,
  errorMessage,
  editModeInitial,
  onSave,
  onClose,
}: EntitlementDetailsSidebarProps) {
  const [isEditModeLocal, setIsEditModeLocal] = useState<boolean>(editModeInitial);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [expandedFramesLocal, setExpandedFramesLocal] = useState<FramesState>({
    general: false,
    business: false,
    technical: false,
    security: false,
    lifecycle: false,
  });
  const [editableFieldsLocal, setEditableFieldsLocal] = useState<any>({ ...(data as any) });

  useEffect(() => {
    if (isEditModeLocal) {
      autoResizeTextarea(descriptionRef.current);
    }
  }, [isEditModeLocal, editableFieldsLocal["Ent Description"]]);

  const toggleFrameLocal = (frame: keyof FramesState) => {
    setExpandedFramesLocal((prev) => ({ ...prev, [frame]: !prev[frame] }));
  };

  const renderSideBySideFieldLocal = (
    label1: string,
    key1: string,
    value1: any,
    label2: string,
    key2: string,
    value2: any
  ) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="min-w-0">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label1}</span>
        {isEditModeLocal ? (
          <input
            type="text"
            value={editableFieldsLocal[key1] || value1 || ""}
            onChange={(e) => setEditableFieldsLocal((prev: any) => ({ ...prev, [key1]: e.target.value }))}
            className="form-input w-full text-sm border-gray-300 rounded mt-1"
          />
        ) : (
          <div className="text-sm text-gray-900 font-medium mt-1 break-words">{value1?.toString() || "N/A"}</div>
        )}
      </div>
      <div className="min-w-0">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label2}</span>
        {isEditModeLocal ? (
          <input
            type="text"
            value={editableFieldsLocal[key2] || value2 || ""}
            onChange={(e) => setEditableFieldsLocal((prev: any) => ({ ...prev, [key2]: e.target.value }))}
            className="form-input w-full text-sm border-gray-300 rounded mt-1"
          />
        ) : (
          <div className="text-sm text-gray-900 font-medium mt-1 break-words">{value2?.toString() || "N/A"}</div>
        )}
      </div>
    </div>
  );

  const renderSingleFieldLocal = (label: string, key: string, value: any) => (
    <div className="min-w-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      {isEditModeLocal ? (
        <input
          type="text"
          value={editableFieldsLocal[key] || value || ""}
          onChange={(e) => setEditableFieldsLocal((prev: any) => ({ ...prev, [key]: e.target.value }))}
          className="form-input w-full text-sm border-gray-300 rounded mt-1"
        />
      ) : (
        <div className="text-sm text-gray-900 font-medium mt-1 break-words">{value?.toString() || "N/A"}</div>
      )}
    </div>
  );

  return (
    <div className="w-full">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {errorMessage ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            ) : (
              <>
                {isEditModeLocal ? (
                  <textarea
                    ref={descriptionRef}
                    value={
                      (editableFieldsLocal as any)["Ent Description"] ||
                      (data as any)?.["Ent Description"] ||
                      ""
                    }
                    onChange={(e) => {
                      setEditableFieldsLocal((prev: any) => ({
                        ...prev,
                        "Ent Description": e.target.value,
                      }));
                      autoResizeTextarea(e.target);
                    }}
                    className="form-input w-full text-sm text-gray-600 rounded overflow-hidden resize-none"
                    rows={2}
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
                    <p className="text-sm text-gray-700 mt-1 break-words whitespace-pre-wrap max-w-full">
                      {(data as any)?.["Ent Description"] ||
                        (data as any)?.["description"] ||
                        "-"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-400 rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            className="flex items-center justify-between w-full text-sm font-semibold text-gray-800 p-3 hover:bg-gray-50 transition-colors"
            onClick={() => toggleFrameLocal("general")}
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 text-blue-700">
                <Info size={15} />
              </span>
              General
            </span>
            {expandedFramesLocal.general ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>
          {expandedFramesLocal.general && (
            <div className="p-4 space-y-4 border-t border-gray-100">
              {renderSideBySideFieldLocal(
                "Type",
                "Ent Type",
                pickValue(data, ["Ent Type", "type", "entitlementType", "entitlementtype"]),
                "#Assignments",
                "Total Assignments",
                (data as any)?.["Total Assignments"]
              )}
              {renderSideBySideFieldLocal(
                "Application",
                "App Name",
                pickValue(data, ["App Name", "applicationName", "applicationname", "appName"]),
                "Tag(s)",
                "Dynamic Tag",
                (data as any)?.["Dynamic Tag"]
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-400 rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-sm font-semibold text-gray-800 p-3 hover:bg-gray-50 transition-colors"
            onClick={() => toggleFrameLocal("business")}
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-100 text-amber-700">
                <Briefcase size={15} />
              </span>
              Business
            </span>
            {expandedFramesLocal.business ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>

          {expandedFramesLocal.business && (
            <div className="p-4 space-y-4 border-t border-gray-100">
              {renderSingleFieldLocal(
                "Objective",
                "Business Objective",
                (data as any)?.["Business Objective"]
              )}
              {renderSideBySideFieldLocal(
                "Business Unit",
                "Business Unit",
                (data as any)?.["Business Unit"],
                "Business Owner",
                "Ent Owner",
                (data as any)?.["Ent Owner"]
              )}
              {renderSingleFieldLocal(
                "Regulatory Scope",
                "Compliance Type",
                (data as any)?.["Compliance Type"]
              )}
              {renderSideBySideFieldLocal(
                "Data Classification",
                "Data Classification",
                (data as any)?.["Data Classification"],
                "Cost Center",
                "Cost Center",
                pickValue(data, ["Cost Center", "cost_center", "costCenter"])
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-purple-400 rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-sm font-semibold text-gray-800 p-3 hover:bg-gray-50 transition-colors"
            onClick={() => toggleFrameLocal("technical")}
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-purple-100 text-purple-700">
                <Cpu size={15} />
              </span>
              Technical
            </span>
            {expandedFramesLocal.technical ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>
          {expandedFramesLocal.technical && (
            <div className="p-4 space-y-4 border-t border-gray-100">
              {renderSideBySideFieldLocal(
                "Created On",
                "Created On",
                formatDate((data as any)?.["Created On"]),
                "Last Sync",
                "Last Sync",
                formatDate((data as any)?.["Last Sync"])
              )}
              {renderSideBySideFieldLocal(
                "Application",
                "App Name",
                (data as any)?.["App Name"],
                "App Instance",
                "App Instance",
                (data as any)?.["App Instance"]
              )}
              {renderSideBySideFieldLocal(
                "App Owner",
                "App Owner",
                (data as any)?.["App Owner"],
                "Ent Owner",
                "Ent Owner",
                (data as any)?.["Ent Owner"]
              )}
              {renderSideBySideFieldLocal(
                "Hierarchy",
                "Hierarchy",
                (data as any)?.["Hierarchy"],
                "MFA Status",
                "MFA Status",
                (data as any)?.["MFA Status"]
              )}
              {renderSingleFieldLocal(
                "Assigned to/Member of",
                "assignment",
                (data as any)?.["assignment"]
              )}
              {renderSingleFieldLocal(
                "License Type",
                "License Type",
                (data as any)?.["License Type"]
              )}
              {renderSingleFieldLocal(
                "Logical Application",
                "Logical Application",
                pickValue(data, [
                  "Logical Application",
                  "logicalApplication",
                  "logical_application",
                  "logicalApp",
                ])
              )}
              {renderSingleFieldLocal(
                "Application Category",
                "Application Category",
                pickValue(data, [
                  "Application Category",
                  "applicationCategory",
                  "application_category",
                  "appCategory",
                ])
              )}
              {renderSingleFieldLocal(
                "Associated Access",
                "Associated Access",
                pickValue(data, [
                  "Associated Access",
                  "associatedAccess",
                  "associated_access",
                ])
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-red-400 rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-sm font-semibold text-gray-800 p-3 hover:bg-gray-50 transition-colors"
            onClick={() => toggleFrameLocal("security")}
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-red-100 text-red-700">
                <ShieldCheck size={15} />
              </span>
              Security
            </span>
            {expandedFramesLocal.security ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>
          {expandedFramesLocal.security && (
            <div className="p-4 space-y-4 border-t border-gray-100">
              {renderSideBySideFieldLocal(
                "Risk",
                "Risk",
                pickValue(data, ["Risk", "risk", "riskLevel"]),
                "Certifiable",
                "Certifiable",
                (data as any)?.["Certifiable"]
              )}
              {renderSideBySideFieldLocal(
                "Revoke on Disable",
                "Revoke on Disable",
                (data as any)?.["Revoke on Disable"],
                "Shared Pwd",
                "Shared Pwd",
                (data as any)?.["Shared Pwd"]
              )}
              {renderSingleFieldLocal(
                "SoD/Toxic Combination",
                "SOD Check",
                (data as any)?.["SOD Check"]
              )}
              {renderSingleFieldLocal(
                "Access Scope",
                "Access Scope",
                (data as any)?.["Access Scope"]
              )}
              {renderSideBySideFieldLocal(
                "Review Schedule",
                "Review Schedule",
                (data as any)?.["Review Schedule"],
                "Last Reviewed On",
                "Last Reviewed on",
                formatDate((data as any)?.["Last Reviewed on"])
              )}
              {renderSideBySideFieldLocal(
                "Privileged",
                "Privileged",
                (data as any)?.["Privileged"],
                "Non Persistent Access",
                "Non Persistent Access",
                (data as any)?.["Non Persistent Access"]
              )}
              {renderSingleFieldLocal(
                "Audit Comments",
                "Audit Comments",
                (data as any)?.["Audit Comments"]
              )}
              {renderSingleFieldLocal(
                "Account Type Restriction",
                "Account Type Restriction",
                (data as any)?.["Account Type Restriction"]
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-teal-400 rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-sm font-semibold text-gray-800 p-3 hover:bg-gray-50 transition-colors"
            onClick={() => toggleFrameLocal("lifecycle")}
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-teal-100 text-teal-700">
                <RefreshCw size={15} />
              </span>
              Lifecycle
            </span>
            {expandedFramesLocal.lifecycle ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>
          {expandedFramesLocal.lifecycle && (
            <div className="p-4 space-y-4 border-t border-gray-100">
              {renderSideBySideFieldLocal(
                "Requestable",
                "Requestable",
                (data as any)?.["Requestable"],
                "Pre-Requisite",
                "Pre- Requisite",
                (data as any)?.["Pre- Requisite"]
              )}
              {renderSingleFieldLocal(
                "Pre-Req Details",
                "Pre-Requisite Details",
                (data as any)?.["Pre-Requisite Details"]
              )}
              {renderSingleFieldLocal(
                "Auto Assign Access Policy",
                "Auto Assign Access Policy",
                (data as any)?.["Auto Assign Access Policy"]
              )}
              {renderSingleFieldLocal(
                "Provisioner Group",
                "Provisioner Group",
                (data as any)?.["Provisioner Group"]
              )}
              {renderSingleFieldLocal(
                "Provisioning Steps",
                "Provisioning Steps",
                (data as any)?.["Provisioning Steps"]
              )}
              {renderSingleFieldLocal(
                "Provisioning Mechanism",
                "Provisioning Mechanism",
                (data as any)?.["Provisioning Mechanism"]
              )}
              {renderSingleFieldLocal(
                "Action on Native Change",
                "Action on Native Change",
                (data as any)?.["Action on Native Change"]
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
        {!isEditModeLocal && (
          <button
            type="button"
            onClick={() => {
              setIsEditModeLocal(true);
              setEditableFieldsLocal({ ...(data as any) });
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
            aria-label="Edit entitlement"
          >
            Edit
          </button>
        )}
        {isEditModeLocal && (
          <>
            <button
              type="button"
              onClick={() => {
                setIsEditModeLocal(false);
                setEditableFieldsLocal({ ...(data as any) });
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              aria-label="Cancel edits"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(editableFieldsLocal)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Save edits"
            >
              Save
            </button>
          </>
        )}
      </div>
    </div>
  );
}
