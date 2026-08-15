"use client";

import { ChevronDown, ChevronRight, FolderIcon } from "lucide-react";
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
    <div className="flex space-x-4 text-sm text-gray-700">
      <div className="flex-1">
        <strong>{label1}:</strong>{" "}
        {isEditModeLocal ? (
          <input
            type="text"
            value={editableFieldsLocal[key1] || value1 || ""}
            onChange={(e) => setEditableFieldsLocal((prev: any) => ({ ...prev, [key1]: e.target.value }))}
            className="form-input w-full text-sm border-gray-300 rounded"
          />
        ) : (
          value1?.toString() || "N/A"
        )}
      </div>
      <div className="flex-1">
        <strong>{label2}:</strong>{" "}
        {isEditModeLocal ? (
          <input
            type="text"
            value={editableFieldsLocal[key2] || value2 || ""}
            onChange={(e) => setEditableFieldsLocal((prev: any) => ({ ...prev, [key2]: e.target.value }))}
            className="form-input w-full text-sm border-gray-300 rounded"
          />
        ) : (
          value2?.toString() || "N/A"
        )}
      </div>
    </div>
  );

  const renderSingleFieldLocal = (label: string, key: string, value: any) => (
    <div className="text-sm text-gray-700">
      <strong>{label}:</strong>{" "}
      {isEditModeLocal ? (
        <input
          type="text"
          value={editableFieldsLocal[key] || value || ""}
          onChange={(e) => setEditableFieldsLocal((prev: any) => ({ ...prev, [key]: e.target.value }))}
          className="form-input w-full text-sm border-gray-300 rounded"
        />
      ) : (
        value?.toString() || "N/A"
      )}
    </div>
  );

  return (
    <div className="w-full">
      <div className="p-4 bg-gray-50">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {errorMessage ? (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
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
                    className="form-input w-full text-sm text-gray-600 mt-2 rounded overflow-hidden resize-none"
                    rows={2}
                  />
                ) : (
                  <>
                    <h3 className="text-md font-semibold text-gray-600">Description :-</h3>
                    <p className="text-sm text-gray-600 mt-1 break-words break-all whitespace-pre-wrap max-w-full">
                      {(data as any)?.["Ent Description"] ||
                        (data as any)?.["description"] ||
                        "description: -"}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white border border-gray-200 rounded-md shadow-sm">
          <button
            type="button"
            className="flex items-center justify-between w-full text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
            onClick={() => toggleFrameLocal("general")}
          >
            <span className="flex items-center">
              <FolderIcon size={18} className="mr-2 text-gray-600" />
              General
            </span>
            {expandedFramesLocal.general ? (
              <ChevronDown size={20} className="text-gray-600" />
            ) : (
              <ChevronRight size={20} className="text-gray-600" />
            )}
          </button>
          {expandedFramesLocal.general && (
            <div className="p-4 space-y-2">
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

        <div className="bg-white border border-gray-200 rounded-md shadow-sm">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
            onClick={() => toggleFrameLocal("business")}
          >
            <span className="flex items-center">
              <FolderIcon size={18} className="mr-2 text-gray-600" />
              Business
            </span>
            {expandedFramesLocal.business ? (
              <ChevronDown size={20} className="text-gray-600" />
            ) : (
              <ChevronRight size={20} className="text-gray-600" />
            )}
          </button>

          {expandedFramesLocal.business && (
            <div className="p-4 space-y-2">
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

        <div className="bg-white border border-gray-200 rounded-md shadow-sm">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
            onClick={() => toggleFrameLocal("technical")}
          >
            <span className="flex items-center">
              <FolderIcon size={18} className="mr-2 text-gray-600" />
              Technical
            </span>
            {expandedFramesLocal.technical ? (
              <ChevronDown size={20} className="text-gray-600" />
            ) : (
              <ChevronRight size={20} className="text-gray-600" />
            )}
          </button>
          {expandedFramesLocal.technical && (
            <div className="p-4 space-y-2">
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

        <div className="bg-white border border-gray-200 rounded-md shadow-sm">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
            onClick={() => toggleFrameLocal("security")}
          >
            <span className="flex items-center">
              <FolderIcon size={18} className="mr-2 text-gray-600" />
              Security
            </span>
            {expandedFramesLocal.security ? (
              <ChevronDown size={20} className="text-gray-600" />
            ) : (
              <ChevronRight size={20} className="text-gray-600" />
            )}
          </button>
          {expandedFramesLocal.security && (
            <div className="p-4 space-y-2">
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

        <div className="bg-white border border-gray-200 rounded-md shadow-sm">
          <button
            type="button"
            className="flex items-center w-full justify-between text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
            onClick={() => toggleFrameLocal("lifecycle")}
          >
            <span className="flex items-center">
              <FolderIcon size={18} className="mr-2 text-gray-600" />
              Lifecycle
            </span>
            {expandedFramesLocal.lifecycle ? (
              <ChevronDown size={20} className="text-gray-600" />
            ) : (
              <ChevronRight size={20} className="text-gray-600" />
            )}
          </button>
          {expandedFramesLocal.lifecycle && (
            <div className="p-4 space-y-2">
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

      <div className="p-4 bg-gray-50 flex space-x-2">
        {!isEditModeLocal && (
          <button
            type="button"
            onClick={() => {
              setIsEditModeLocal(true);
              setEditableFieldsLocal({ ...(data as any) });
            }}
            className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            aria-label="Edit entitlement"
          >
            Edit
          </button>
        )}
        {isEditModeLocal && (
          <button
            type="button"
            onClick={() => onSave(editableFieldsLocal)}
            className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            aria-label="Save edits"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}
