"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { optionsForRemidiate } from "@/utils/utils";
import Select from "react-select";
import { Edit2Icon } from "lucide-react";
import UserDisplayName from "./UserDisplayName";
import { executeQuery, modifyAccess, immediateRevoke } from "@/lib/api";

interface RemediateSidebarProps {
  selectedRows: any[];
  onClose: () => void;
  onLockAccount?: (justification: string) => Promise<void>;
  onRevokeAccess?: (justification: string) => Promise<void>;
  onConditionalAccess?: (endDate: string, justification: string) => Promise<void>;
  onModifyAccess?: (newAccess: string, justification: string) => Promise<void>;
  isActionLoading: boolean;
  /** Required to call modifyAccess API (User Manager / App Owner certification flow) */
  reviewerId?: string;
  certId?: string;
  reviewerName?: string;
}

const RemediateSidebar: React.FC<RemediateSidebarProps> = ({
  selectedRows,
  onClose,
  onLockAccount,
  onRevokeAccess,
  onConditionalAccess,
  onModifyAccess,
  isActionLoading,
  reviewerId,
  certId,
  reviewerName = "",
}) => {
  const [lockAccountChecked, setLockAccountChecked] = useState(false);
  const [modifyAccessChecked, setModifyAccessChecked] = useState(false);
  const [immediateRevokeChecked, setImmediateRevokeChecked] = useState(false);
  const [conditionalAccessChecked, setConditionalAccessChecked] =
    useState(false);
  const [conditionalEndDate, setConditionalEndDate] = useState("");
  const [conditionalJustification, setConditionalJustification] =
    useState("");
  const [dateValidationError, setDateValidationError] = useState("");
  const [showLockConfirmation, setShowLockConfirmation] = useState(false);
  const [showRevokeConfirmation, setShowRevokeConfirmation] = useState(false);
  const [revokeJustification, setRevokeJustification] = useState("");
  const [modifyAccessSelectedOption, setModifyAccessSelectedOption] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [comment, setComment] = useState("");
  const [modifyAccessOptions, setModifyAccessOptions] = useState<any[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isModifyAccessLoading, setIsModifyAccessLoading] = useState(false);
  const [modifyAccessError, setModifyAccessError] = useState<string | null>(null);
  const [isImmediateRevokeLoading, setIsImmediateRevokeLoading] = useState(false);
  const [immediateRevokeError, setImmediateRevokeError] = useState<string | null>(null);
  const [isConditionalAccessLoading, setIsConditionalAccessLoading] = useState(false);
  const [conditionalAccessError, setConditionalAccessError] = useState<string | null>(null);

  const definedRows = selectedRows.filter((row) => row && Object.keys(row).length > 0);

  /** Format date from input (YYYY-MM-DD) to API format MM-DD-YYYY */
  const formatEndDateForApi = (dateStr: string): string => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    if (m && d && y) return `${m}-${d}-${y}`;
    return dateStr;
  };

  /** YYYY-MM-DD for <input type="date" min="..." /> from a Date at local midnight. */
  const toInputDateLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Get campaign expiry date from various sources
  const getCampaignExpiryDate = (): string | null => {
    // Try to get from localStorage
    try {
      const campaignSummary = localStorage.getItem("selectedCampaignSummary");
      if (campaignSummary) {
        const parsed = JSON.parse(campaignSummary);
        if (parsed.dueDate) {
          return parsed.dueDate;
        }
      }
    } catch (e) {
      // Ignore errors
    }

    // Try to get from selectedRows (check first row for common field names)
    if (definedRows.length > 0) {
      const firstRow = definedRows[0];
      return (
        firstRow?.certificationExpiration ||
        firstRow?.campaignExpiryDate ||
        firstRow?.expiryDate ||
        firstRow?.dueDate ||
        null
      );
    }

    return null;
  };

  const campaignExpiryDate = getCampaignExpiryDate();

  /** Earliest allowed end date: strictly after certification expiration (next calendar day). */
  const minConditionalEndDateInput = (() => {
    if (!campaignExpiryDate) return undefined;
    const expiryDateObj = new Date(campaignExpiryDate);
    if (isNaN(expiryDateObj.getTime())) return undefined;
    expiryDateObj.setHours(0, 0, 0, 0);
    expiryDateObj.setDate(expiryDateObj.getDate() + 1);
    return toInputDateLocal(expiryDateObj);
  })();

  // Fetch entitlements when Modify Access is checked
  useEffect(() => {
    const fetchEntitlements = async () => {
      if (!modifyAccessChecked) {
        // Reset options when unchecked
        setModifyAccessOptions([]);
        setModifyAccessSelectedOption(null);
        setOptionsError(null);
        return;
      }

      // Extract application name from the first selected row
      if (definedRows.length === 0) {
        setOptionsError("No rows selected");
        setIsLoadingOptions(false);
        return;
      }

      const firstRow = definedRows[0];
      const applicationName =
        firstRow?.applicationName ||
        firstRow?.application ||
        firstRow?.appName ||
        firstRow?.application_name ||
        firstRow?.applicationDisplayName ||
        firstRow?.application_display_name ||
        firstRow?.app ||
        firstRow?.app_display_name ||
        null;

      if (!applicationName) {
        setOptionsError("Application name not found in selected row");
        setIsLoadingOptions(false);
        return;
      }

      setIsLoadingOptions(true);
      setOptionsError(null);

      try {
        // Use the application name from the selected row
        const query = `select name from catalog where type = 'Entitlement' AND applicationname = '${applicationName}'`;
        const parameters: string[] = [];
        
        const response = await executeQuery<any>(query, parameters);
        
        // Handle different response formats
        let entitlements: any[] = [];
        
        if (Array.isArray(response)) {
          entitlements = response;
        } else if (response && typeof response === 'object') {
          // Check for common response wrapper properties
          if ('resultSet' in response && Array.isArray(response.resultSet)) {
            entitlements = response.resultSet;
          } else if ('data' in response && Array.isArray(response.data)) {
            entitlements = response.data;
          } else if ('results' in response && Array.isArray(response.results)) {
            entitlements = response.results;
          } else {
            // Try to find first array property
            const arrayKey = Object.keys(response).find(key => Array.isArray(response[key]));
            if (arrayKey) {
              entitlements = response[arrayKey];
            }
          }
        }

        // Collect entitlement names already assigned to the user from selected rows
        // (User Manager and App Owner row data use entitlementName / entitlement_name / name etc.)
        const assignedEntitlementNames = new Set<string>(
          definedRows
            .map((row: any) =>
              row?.entitlementName ??
              row?.entitlementname ??
              row?.entitlement_name ??
              row?.name
            )
            .filter((name: unknown): name is string => typeof name === "string" && name.trim() !== "")
            .map((name: string) => name.trim())
        );

        // Transform entitlements into dropdown options and exclude already-assigned entitlements
        const options = entitlements
          .filter((item: any) => item && item.name) // Filter out invalid items
          .map((item: any) => ({
            value: item.name,
            label: item.name
          }))
          .filter(
            (opt: { value: string; label: string }) =>
              !assignedEntitlementNames.has(opt.value.trim())
          );

        setModifyAccessOptions(options);
        
        if (options.length === 0) {
          setOptionsError("No entitlements found");
        }
      } catch (error) {
        console.error("Error fetching entitlements:", error);
        setOptionsError(error instanceof Error ? error.message : "Failed to load entitlements");
        setModifyAccessOptions([]);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchEntitlements();
  }, [modifyAccessChecked]);

  // Validate date when it changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    setConditionalEndDate(selectedDate);

    if (!selectedDate) {
      setDateValidationError("");
      return;
    }

    if (campaignExpiryDate) {
      const expiryDateObj = new Date(campaignExpiryDate);
      const selectedDateObj = new Date(selectedDate);

      expiryDateObj.setHours(0, 0, 0, 0);
      selectedDateObj.setHours(0, 0, 0, 0);

      // End date must be strictly after certification expiration (not same day)
      if (selectedDateObj <= expiryDateObj) {
        const formattedExpiry = new Date(
          campaignExpiryDate
        ).toLocaleDateString();
        setDateValidationError(
          `End date must be after the certification expiration date (${formattedExpiry})`
        );
      } else {
        setDateValidationError("");
      }
    }
  };

  const isDateValid = !dateValidationError && conditionalEndDate;

  // Format user name from "amber.henry" to "Amber Henry"
  const formatUserName = (name: string): string => {
    if (!name) return "";
    
    // If it contains a dot, treat as username format (e.g., "amber.henry")
    if (name.includes(".")) {
      return name
        .split(".")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
    }
    
    // If it contains @, it's an email, return as is
    if (name.includes("@")) {
      return name;
    }
    
    // If it contains spaces, capitalize each word
    if (name.includes(" ")) {
      return name
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
    }
    
    // Otherwise, just capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  return (
    <div className="space-y-6">
      {/* Content */}
      <div className="space-y-6 text-sm">
        <div className="space-y-2">
          {definedRows.length > 0 ? (
            definedRows.map((row: any, index: number) => {
              const appName =
                row?.applicationName ||
                row?.application ||
                row?.appName ||
                row?.application_name ||
                row?.applicationDisplayName ||
                row?.application_display_name ||
                row?.app ||
                row?.app_display_name ||
                "N/A";
              const entName =
                row?.entitlementName ||
                row?.entitlement ||
                row?.name ||
                row?.entitlement_name ||
                "N/A";
              const userPrimary =
                row?.fullName ||
                row?.userName ||
                row?.username ||
                row?.user ||
                row?.userDisplayName ||
                row?.user_display_name ||
                "";
              const derivedEmail = (() => {
                const acc = String(row?.accountName || "");
                if (acc.includes("@")) return acc;
                return "";
              })();
              const userSecondary =
                row?.email ||
                row?.userEmail ||
                row?.user_email ||
                derivedEmail ||
                "";
              const userType = row?.userType || row?.employeetype || row?.tags;
              const displayUserName = userPrimary || userSecondary || "N/A";
              const formattedUserName = formatUserName(displayUserName);
              
              return (
                <div key={row.lineItemId || row.id || index} className="flex items-center p-3 bg-gray-50 rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      <UserDisplayName
                        displayName={formattedUserName}
                        userType={userType}
                        employeetype={row?.employeetype}
                        tags={row?.tags}
                      />
                    </p>
                  </div>
                  <span className="mx-4 text-gray-400 flex-shrink-0">→</span>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-medium break-words">{entName}</p>
                    <p className="text-gray-500 text-xs mt-1 break-words">{appName}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 bg-gray-50 rounded-md text-gray-500">No selection</div>
          )}
        </div>

        {/* Conditional Access */}
        <div
          className={`items-center space-x-4 p-2 rounded-md cursor-pointer ${
            conditionalAccessChecked ? "bg-gray-200" : "bg-gray-50"
          }`}
          onClick={(e) => {
            // Don't toggle if clicking on input fields or buttons
            if ((e.target as HTMLElement).tagName === 'INPUT' || 
                (e.target as HTMLElement).tagName === 'TEXTAREA' ||
                (e.target as HTMLElement).tagName === 'BUTTON' ||
                (e.target as HTMLElement).closest('button') ||
                (e.target as HTMLElement).closest('.react-select')) {
              return;
            }
            const newValue = !conditionalAccessChecked;
            setConditionalAccessChecked(newValue);
            if (!newValue) {
              setConditionalEndDate("");
              setConditionalJustification("");
              setDateValidationError("");
            }
          }}
        >
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer pointer-events-none">
              <input
                type="checkbox"
                checked={conditionalAccessChecked}
                onChange={(e) => {
                  setConditionalAccessChecked(e.target.checked);
                  if (!e.target.checked) {
                    setConditionalEndDate("");
                    setConditionalJustification("");
                    setDateValidationError("");
                  }
                }}
                className="cursor-pointer pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              />
              <h2 className="font-semibold">Conditional Access</h2>
            </label>
            {conditionalAccessChecked && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const justification =
                    conditionalJustification.trim() || "Conditional access";
                  const endDateFormatted = formatEndDateForApi(conditionalEndDate);

                  const canCallModifyAccess =
                    reviewerId &&
                    certId &&
                    definedRows.length > 0 &&
                    endDateFormatted;

                  if (canCallModifyAccess) {
                    setIsConditionalAccessLoading(true);
                    setConditionalAccessError(null);
                    try {
                      const taskId =
                        (definedRows[0] as any)?.taskId ??
                        (definedRows[0] as any)?.taskid ??
                        "";
                      if (!taskId) {
                        setConditionalAccessError("Task ID not found in selected row");
                        return;
                      }
                      for (const row of definedRows) {
                        const rowTaskId =
                          (row as any).taskId ??
                          (row as any).taskid ??
                          taskId;
                        const lineItemId =
                          (row as any).lineItemId ??
                          (row as any).lineitemid ??
                          "";
                        const accountLineItemId =
                          (row as any).accountLineItemId ??
                          (row as any).parentLineItemId ??
                          (row as any).lineItemId ??
                          lineItemId;
                        const accountId =
                          (row as any).accountId ?? (row as any).accountid ?? "";
                        const applicationName =
                          (row as any).applicationName ??
                          (row as any).application ??
                          (row as any).appName ??
                          (row as any).application_name ??
                          "";
                        const name =
                          (row as any).entitlementName ??
                          (row as any).entitlementname ??
                          (row as any).entitlement_name ??
                          (row as any).name ??
                          "";
                        if (!rowTaskId || !lineItemId) continue;
                        await modifyAccess(
                          reviewerId,
                          certId,
                          rowTaskId,
                          lineItemId,
                          {
                            reviewerName: reviewerName || "Reviewer",
                            reviewerId,
                            certificationId: certId,
                            taskId: rowTaskId,
                            removeAccess: [
                              {
                                parentLineItemId: accountLineItemId,
                                lineItemId,
                                name,
                                accountId,
                                applicationName,
                                justification,
                                endDate: endDateFormatted,
                              },
                            ],
                            addAccess: [],
                          }
                        );
                      }
                      setConditionalAccessChecked(false);
                      setConditionalEndDate("");
                      setConditionalJustification("");
                      setDateValidationError("");
                      if (onConditionalAccess) {
                        await onConditionalAccess(conditionalEndDate, justification);
                      }
                      onClose();
                    } catch (err) {
                      setConditionalAccessError(
                        err instanceof Error ? err.message : "Conditional access request failed"
                      );
                    } finally {
                      setIsConditionalAccessLoading(false);
                    }
                  } else if (onConditionalAccess) {
                    await onConditionalAccess(conditionalEndDate, justification);
                    setConditionalAccessChecked(false);
                    setConditionalEndDate("");
                    setConditionalJustification("");
                    setDateValidationError("");
                  }
                }}
                disabled={
                  isActionLoading ||
                  isConditionalAccessLoading ||
                  !isDateValid ||
                  !conditionalJustification.trim() ||
                  ((!reviewerId || !certId) && !onConditionalAccess)
                }
                className={`rounded-sm p-2 pointer-events-auto ${
                  isActionLoading ||
                  isConditionalAccessLoading ||
                  !isDateValid ||
                  !conditionalJustification.trim() ||
                  ((!reviewerId || !certId) && !onConditionalAccess)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#15274E] text-white hover:bg-blue-900"
                }`}
              >
                {isActionLoading || isConditionalAccessLoading ? "Processing..." : "Apply"}
              </button>
            )}
          </div>
          {conditionalAccessChecked && (
            <div className="mt-3 space-y-3 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              {conditionalAccessError && (
                <p className="text-sm text-red-600">{conditionalAccessError}</p>
              )}
              <div>
                <span className="flex items-center mb-1">End date</span>
                <input
                  type="date"
                  value={conditionalEndDate}
                  onChange={handleDateChange}
                  min={minConditionalEndDateInput}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white ${
                    dateValidationError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300"
                  }`}
                />
                {dateValidationError && (
                  <p className="text-red-500 text-xs mt-1">{dateValidationError}</p>
                )}
              </div>
              <div>
                <span className="flex items-center mb-1">Justification</span>
                <textarea
                  rows={2}
                  value={conditionalJustification}
                  onChange={(e) =>
                    setConditionalJustification(e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modify Access */}
        <div
          className={`items-center space-x-4 p-2 rounded-md cursor-pointer ${
            immediateRevokeChecked ? "bg-gray-200" : "bg-gray-50"
          }`}
          onClick={(e) => {
            if (immediateRevokeChecked) return;
            // Don't toggle if clicking on input fields or buttons
            if ((e.target as HTMLElement).tagName === 'INPUT' || 
                (e.target as HTMLElement).tagName === 'TEXTAREA' ||
                (e.target as HTMLElement).tagName === 'BUTTON' ||
                (e.target as HTMLElement).closest('button') ||
                (e.target as HTMLElement).closest('.react-select')) {
              return;
            }
            setModifyAccessChecked(!modifyAccessChecked);
          }}
        >
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer pointer-events-none">
              <input
                type="checkbox"
                checked={modifyAccessChecked}
                disabled={immediateRevokeChecked}
                onChange={(e) => setModifyAccessChecked(e.target.checked)}
                className="cursor-pointer pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              />
              <h2 className="font-semibold">Modify Access</h2>
            </label>
            {modifyAccessChecked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmation(true);
                }}
                disabled={!modifyAccessSelectedOption || isActionLoading}
                className={`cursor-pointer text-white rounded-sm p-2 pointer-events-auto ${
                  !modifyAccessSelectedOption || immediateRevokeChecked || isActionLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#15274E]"
                }`}
              >
                {isActionLoading ? "Processing..." : "Modify Access"}
              </button>
            )}
          </div>
          {modifyAccessChecked && (
            <div className="mt-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <span className="flex items-center m-2">
                Select New Access
              </span>
              {isLoadingOptions ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading entitlements...</div>
              ) : optionsError ? (
                <div className="px-3 py-2 text-sm text-red-500">{optionsError}</div>
              ) : (
                <Select
                  options={modifyAccessOptions.length > 0 ? modifyAccessOptions : optionsForRemidiate}
                  isDisabled={immediateRevokeChecked || isLoadingOptions}
                  isLoading={isLoadingOptions}
                  value={modifyAccessSelectedOption}
                  onChange={setModifyAccessSelectedOption}
                  placeholder={isLoadingOptions ? "Loading..." : "Select an entitlement"}
                  styles={{
                    control: (base) => ({ ...base, fontSize: "0.875rem" }),
                    menu: (base) => ({ ...base, fontSize: "0.875rem" }),
                  }}
                />
              )}
            </div>
          )}
          {modifyAccessChecked && (
            <div className="mt-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <span className="flex items-center m-2">Comments</span>
              <div className="flex">
                <textarea
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mr-2"
                  rows={1}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                      <button
                        disabled={!comment.trim()}
                        className={`rounded-lg p-2 ${
                          comment.trim()
                            ? "bg-[#2684ff] text-white hover:bg-blue-600"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <Edit2Icon />
                      </button>
              </div>
            </div>
          )}
          {showConfirmation &&
            createPortal(
              <div 
                className="fixed inset-0 flex items-center justify-center z-[100] bg-black/30"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div 
                  className="bg-white p-6 rounded-lg shadow-2xl max-w-sm space-y-4 border-2 border-gray-300 ring-4 ring-blue-100" 
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <p className="text-base font-medium text-gray-800">
                    Are you sure you want to modify access?
                  </p>
                  {modifyAccessError && (
                    <p className="text-sm text-red-600">{modifyAccessError}</p>
                  )}
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirmation(false);
                      }}
                      className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newAccessName = modifyAccessSelectedOption?.value || modifyAccessSelectedOption?.label || "";
                        const justification = comment?.trim() || "Modified access";
                        if (!newAccessName) return;

                        const canCallApi = reviewerId && certId && definedRows.length > 0;

                        if (canCallApi) {
                          setIsModifyAccessLoading(true);
                          setModifyAccessError(null);
                          try {
                            for (const row of definedRows) {
                              const taskId =
                                row.taskId ??
                                row.taskid ??
                                (definedRows[0] as any)?.taskId ??
                                "";
                              const lineItemId =
                                row.lineItemId ??
                                row.lineitemid ??
                                row.accountLineItemId ??
                                "";
                              const accountId = row.accountId ?? row.accountid ?? "";
                              const applicationName =
                                row.applicationName ??
                                row.application ??
                                row.appName ??
                                row.application_name ??
                                row.applicationDisplayName ??
                                row.app ??
                                "";
                              const currentEntitlementName =
                                row.entitlementName ??
                                row.entitlementname ??
                                row.entitlement_name ??
                                row.name ??
                                "";
                              const parentLineItemId =
                                row.parentLineItemId ??
                                row.accountLineItemId ??
                                row.lineItemId ??
                                lineItemId;

                              if (!taskId || !lineItemId) continue;

                              await modifyAccess(
                                reviewerId,
                                certId,
                                taskId,
                                lineItemId,
                                {
                                  reviewerName: reviewerName || "Reviewer",
                                  reviewerId,
                                  certificationId: certId,
                                  taskId,
                                  removeAccess: [
                                    {
                                      parentLineItemId,
                                      lineItemId,
                                      name: currentEntitlementName,
                                      accountId,
                                      applicationName,
                                      justification,
                                    },
                                  ],
                                  addAccess: [
                                    {
                                      parentLineItemId,
                                      name: newAccessName,
                                      accountId,
                                      applicationName,
                                      justification,
                                    },
                                  ],
                                }
                              );
                            }
                            setShowConfirmation(false);
                            setModifyAccessSelectedOption(null);
                            setComment("");
                            if (onModifyAccess) {
                              await onModifyAccess(newAccessName, justification);
                            }
                            window.location.reload();
                          } catch (err) {
                            setModifyAccessError(
                              err instanceof Error ? err.message : "Failed to modify access"
                            );
                          } finally {
                            setIsModifyAccessLoading(false);
                          }
                        } else if (onModifyAccess) {
                          await onModifyAccess(newAccessName, justification);
                          setShowConfirmation(false);
                          setModifyAccessSelectedOption(null);
                          setComment("");
                        }
                      }}
                      disabled={!modifyAccessSelectedOption || isModifyAccessLoading}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        !modifyAccessSelectedOption || isModifyAccessLoading
                          ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {isModifyAccessLoading ? "Processing..." : "Confirm"}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Lock Account */}
        {/* <div 
          className="items-center space-x-4 p-2 bg-gray-50 rounded-md cursor-pointer"
          onClick={(e) => {
            // Don't toggle if clicking on input fields or buttons
            if ((e.target as HTMLElement).tagName === 'INPUT' || 
                (e.target as HTMLElement).tagName === 'BUTTON' ||
                (e.target as HTMLElement).closest('button')) {
              return;
            }
            const checked = !lockAccountChecked;
            setLockAccountChecked(checked);
            if (checked) {
              setShowLockConfirmation(true);
            }
          }}
        >
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer pointer-events-none">
              <input
                type="checkbox"
                checked={lockAccountChecked}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setLockAccountChecked(checked);
                  if (checked) {
                    setShowLockConfirmation(true);
                  }
                }}
                className="cursor-pointer pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              />
              <h2 className="font-semibold">Lock Account</h2>
            </label>
          </div>
        </div> */}

        {/* Immediate Revoke */}
        <div
          className={`items-center space-x-4 p-2 rounded-md cursor-pointer ${
            modifyAccessChecked ? "bg-gray-200" : "bg-gray-50"
          }`}
          onClick={(e) => {
            if (modifyAccessChecked) return;
            // Don't toggle if clicking on input fields or buttons
            if ((e.target as HTMLElement).tagName === 'INPUT' || 
                (e.target as HTMLElement).tagName === 'BUTTON' ||
                (e.target as HTMLElement).closest('button')) {
              return;
            }
            const checked = !immediateRevokeChecked;
            setImmediateRevokeChecked(checked);
            if (checked) {
              setShowRevokeConfirmation(true);
            } else {
              setRevokeJustification("");
            }
          }}
        >
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer pointer-events-none">
              <input
                type="checkbox"
                checked={immediateRevokeChecked}
                disabled={modifyAccessChecked}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setImmediateRevokeChecked(checked);
                  if (checked) {
                    setShowRevokeConfirmation(true);
                  } else {
                    setRevokeJustification("");
                  }
                }}
                className="cursor-pointer pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              />
              <h2 className="font-semibold">Immediate Revoke</h2>
            </label>
          </div>
        </div>

        {/* Lock Account Confirmation Popup */}
        {showLockConfirmation &&
          createPortal(
            <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/30">
              <div 
                className="bg-white p-6 rounded-lg shadow-2xl max-w-sm space-y-4 border-2 border-gray-300 ring-4 ring-blue-100"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <p className="text-base font-medium text-gray-800">
                  Are you sure you want to lock the account with immediate
                  effect?
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLockConfirmation(false);
                      setLockAccountChecked(false);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!onLockAccount) return;

                      await onLockAccount(
                        "Lock account with immediate effect from Remediate"
                      );
                      setShowLockConfirmation(false);
                      setLockAccountChecked(false);
                    }}
                    disabled={isActionLoading || !onLockAccount}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActionLoading || !onLockAccount
                        ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isActionLoading ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Immediate Revoke Confirmation Popup */}
        {showRevokeConfirmation &&
          createPortal(
            <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/30">
              <div 
                className="bg-white p-6 rounded-lg shadow-2xl max-w-sm space-y-4 border-2 border-gray-300 ring-4 ring-blue-100"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <p className="text-base font-medium text-gray-800">
                  Are you sure you want to revoke access immediately?
                </p>
                {immediateRevokeError && (
                  <p className="text-sm text-red-600">{immediateRevokeError}</p>
                )}
                <div>
                  <span className="flex items-center mb-1">Justification</span>
                  <textarea
                    rows={2}
                    value={revokeJustification}
                    onChange={(e) => setRevokeJustification(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none bg-white"
                    placeholder="Enter justification for revoking access"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRevokeConfirmation(false);
                      setImmediateRevokeChecked(false);
                      setRevokeJustification("");
                      setImmediateRevokeError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const justification =
                        revokeJustification.trim() || "Immediate revoke";
                      if (!justification || !onRevokeAccess) return;

                      setIsImmediateRevokeLoading(true);
                      setImmediateRevokeError(null);
                      try {
                        await onRevokeAccess(justification);
                        setShowRevokeConfirmation(false);
                        setImmediateRevokeChecked(false);
                        setRevokeJustification("");
                      } catch (err) {
                        setImmediateRevokeError(
                          err instanceof Error
                            ? err.message
                            : "Failed to queue revoke access"
                        );
                      } finally {
                        setIsImmediateRevokeLoading(false);
                      }
                    }}
                    disabled={
                      isActionLoading ||
                      isImmediateRevokeLoading ||
                      !revokeJustification.trim() ||
                      !onRevokeAccess
                    }
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActionLoading ||
                      isImmediateRevokeLoading ||
                      !revokeJustification.trim() ||
                      !onRevokeAccess
                        ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isImmediateRevokeLoading ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
      
      {/* Footer with Close Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Close
        </button>
      </div>

    </div>
  );
};

export default RemediateSidebar;
