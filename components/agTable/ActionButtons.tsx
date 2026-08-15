"use client";
import { GridApi } from "ag-grid-enterprise";
import { createPortal } from "react-dom";
import {
  CircleCheck,
  CircleOff,
  CircleX,
  Edit2Icon,
  MoreVertical,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Buttons from "react-multi-date-picker/components/button";
import ProxyActionModal from "../ProxyActionModal";
import DelegateActionModal from "../DelegateActionModal";
import { useLoading } from "@/contexts/LoadingContext";
import { useActionPanel } from "@/contexts/ActionPanelContext";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import RemediateSidebar from "../RemediateSidebar";

interface User {
  username: string;
  email: string;
  role: string;
}

interface Group {
  name: string;
  email: string;
  role: string;
}

interface ActionButtonsProps<T> {
  api: GridApi;
  selectedRows: T[];
  context: "user" | "account" | "entitlement";
  reviewerId: string;
  certId: string;
  viewChangeEnable?: boolean;
  onActionSuccess?: () => void; // Callback to notify parent of success
  userEmail?: string; // User email for Teams link
  selectedFilters?: string[]; // Selected filters to control button visibility
  hideTeamsIcon?: boolean; // Flag to hide Teams icon (e.g., in floating buttons)
}

// Module-level storage for pending actions to persist across component re-renders
// This is necessary because AG Grid cell renderers can be recreated, losing component state
const pendingActionsStorage = new Map<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'>();

// Module-level storage for comments/justifications to persist across component re-renders
const commentsStorage = new Map<string, string>();

// Export function to clear pending actions storage
export const clearPendingActionsStorage = () => {
  pendingActionsStorage.clear();
  commentsStorage.clear();
};

function nonEmptyTrimmed(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/**
 * Comment / justification on a grid row. Prefer "new" reviewer comment over generic `comment`
 * and over historical fields (`oldComments`, `previousComment`, etc.).
 */
function extractCommentFromRow(row: any): string | null {
  if (!row) return null;

  const newCommentFields = [
    "newComment",
    "new_comment",
    "newcomment",
    "NewComment",
    "NEW_COMMENT",
    "newJustification",
    "new_justification",
    "newjustification",
    "NewJustification",
  ];

  const generalCommentFields = [
    "comment",
    "Comment",
    "COMMENT",
    "justification",
    "Justification",
    "JUSTIFICATION",
    "reviewComment",
    "review_comment",
    "reviewcomment",
    "actionComment",
    "action_comment",
    "actioncomment",
  ];

  const oldOrPreviousCommentFields = [
    "oldComments",
    "oldComment",
    "OldComments",
    "OldComment",
    "previousComment",
    "previous_comment",
    "PreviousComment",
    "priorComment",
    "prior_comment",
    "lastComment",
    "last_comment",
  ];

  const isHistoricalCommentKey = (key: string): boolean => {
    const k = key.toLowerCase();
    if (oldOrPreviousCommentFields.some((f) => f.toLowerCase() === k))
      return true;
    if (k.startsWith("old") && k.includes("comment")) return true;
    if (k.includes("previous") && k.includes("comment")) return true;
    return false;
  };

  for (const field of newCommentFields) {
    const s = nonEmptyTrimmed(row[field]);
    if (s) return s;
  }
  for (const field of generalCommentFields) {
    const s = nonEmptyTrimmed(row[field]);
    if (s) return s;
  }

  const rowKeys = Object.keys(row);
  const dynamicKey = rowKeys.find((key) => {
    if (isHistoricalCommentKey(key)) return false;
    const k = key.toLowerCase();
    return k.includes("comment") || k.includes("justification");
  });
  if (dynamicKey) {
    const s = nonEmptyTrimmed(row[dynamicKey]);
    if (s) return s;
  }

  for (const field of oldOrPreviousCommentFields) {
    const s = nonEmptyTrimmed(row[field]);
    if (s) return s;
  }

  return null;
}

function extractRemediationEndDateFromRow(row: any): string | null {
  if (!row) return null;
  const keys = [
    "remediateOn",
    "remediationEndDate",
    "remediateEndDate",
    "endDate",
    "itemEndDate",
    "conditionalEndDate",
  ];
  for (const k of keys) {
    const s = nonEmptyTrimmed(row[k]);
    if (s) return s;
  }
  return null;
}

function extractRemediationJustificationFromRows(rows: any[]): string {
  for (const row of rows) {
    const explicit = nonEmptyTrimmed(
      row?.remediationJustification ?? row?.remediateJustification
    );
    if (explicit) return explicit;
  }
  for (const row of rows) {
    const fromComment = extractCommentFromRow(row);
    if (fromComment) return fromComment;
  }
  return "";
}

function extractRemediateActionFromRows(rows: any[]): string {
  if (!rows.length) return "";
  const unique = Array.from(
    new Set(
      rows
        .map((r) => nonEmptyTrimmed(r?.remediateAction))
        .filter((s): s is string => Boolean(s))
    )
  );
  return unique.join(", ");
}

const ActionButtons = <T extends { status?: string }>({
  api,
  selectedRows,
  context,
  reviewerId,
  certId,
  viewChangeEnable,
  onActionSuccess,
  userEmail,
  selectedFilters = [],
  hideTeamsIcon = false,
}: ActionButtonsProps<T>): JSX.Element => {
  const { queueAction, reset } = useActionPanel();
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isRemediateDetailModalOpen, setIsRemediateDetailModalOpen] =
    useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentCategory, setCommentCategory] = useState("");
  const [commentSubcategory, setCommentSubcategory] = useState("");
  const [isCommentDropdownOpen, setIsCommentDropdownOpen] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<User | Group | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  // Use a state that syncs with module-level storage to trigger re-renders
  const [pendingById, setPendingById] = useState<Record<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'>>(() => {
    // Initialize from module-level storage
    const initial: Record<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'> = {};
    pendingActionsStorage.forEach((value, key) => {
      initial[key] = value;
    });
    return initial;
  });
  const [hasRemediateAction, setHasRemediateAction] = useState(false);
  
  const { showApiLoader, hideApiLoader } = useLoading();

  // Check if certify filter is active (show only Approve button)
  const isCertifyFilterActive = selectedFilters.some(
    (filter) => filter.trim().toLowerCase() === "certify"
  );

  // Check if reject filter is active (show only Revoke button)
  const isRejectFilterActive = selectedFilters.some(
    (filter) => filter.trim().toLowerCase() === "reject"
  );

  // Filter out undefined/null rows (e.g., group rows can pass undefined data)
  const definedRows = (selectedRows || []).filter((r): r is T => !!r);
  // Determine if all selected rows have the same status (normalized)
  const rowStatusRaw = definedRows.length > 0 ? (definedRows[0] as any)?.status : null;
  const rowStatus = typeof rowStatusRaw === 'string' ? rowStatusRaw : (rowStatusRaw ? String(rowStatusRaw) : null);
  const normalizedStatus = (rowStatus || "").toString().trim().toLowerCase();
  // Treat approved/certified similarly; rejected/revoked similarly (backend may return Reject or Revoke)
  const isApproved = normalizedStatus === "approved" || normalizedStatus === "certified";
  const isRejected = normalizedStatus === "rejected" || normalizedStatus === "revoked" || normalizedStatus === "reject";

  // Local pending visualization: if all selected rows have same pending action, reflect it on the button
  // Filter out duplicates and invalid IDs
  const selectedIds = Array.from(new Set(
    definedRows
      .map((row: any) => row.lineItemId || row.id)
      .filter((id: any) => Boolean(id) && id !== 'undefined' && id !== 'null')
  )) as string[];
  // Check both state and module-level storage for pending actions
  const getPendingAction = (id: string): 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate' | undefined => {
    return pendingById[id] || pendingActionsStorage.get(id);
  };
  const isApprovePending = selectedIds.length > 0 && selectedIds.every((id) => getPendingAction(id) === 'Approve');
  const isRejectPending = selectedIds.length > 0 && selectedIds.every((id) => getPendingAction(id) === 'Reject');
  const isPendingReset = selectedIds.length > 0 && selectedIds.some((id) => getPendingAction(id) === 'Pending');
  const isAllPendingReset = selectedIds.length > 0 && selectedIds.every((id) => getPendingAction(id) === 'Pending');
  const hasAnyPending = isApprovePending || isRejectPending || isPendingReset;

  // Check if action is Approve/Reject/Remediate/Delegate for entitlement context (normalized)
  const actionRaw = definedRows.length > 0 ? (definedRows[0] as any)?.action : null;
  const actionLower = (actionRaw ? String(actionRaw) : "").trim().toLowerCase();
  const statusRaw = definedRows.length > 0 ? (definedRows[0] as any)?.status : null;
  const statusLower = (statusRaw ? String(statusRaw) : "").trim().toLowerCase();
  const isApproveAction = context === "entitlement" && actionLower === "approve";
  const isRejectAction = context === "entitlement" && (actionLower === "reject" || actionLower === "revoke");
  const isRemediatedFromRow = context === "entitlement" && definedRows.some(
    (row: any) => row.isRemediated === true || String(row.isRemediated || "").toUpperCase() === "Y"
  );
  const isRemediateAction = context === "entitlement" && (actionLower === "remediate" || statusLower === "remediated");
  const isDelegateAction = context === "entitlement" && (actionLower === "delegate" || statusLower === "delegated");
  const hasRemediateStatus = hasRemediateAction || isRemediateAction || isRemediatedFromRow ||
    selectedIds.some((id) => getPendingAction(id) === 'Remediate');
  const hasRemediatedRows =
    context === "entitlement" &&
    definedRows.some(
      (row: any) =>
        row.isRemediated === true ||
        String(row.isRemediated || "").toUpperCase() === "Y"
    );
  /** After queuing Pending to undo remediation, show normal actions instead of the R badge */
  const isRemediateUndoQueued =
    hasRemediatedRows &&
    selectedIds.length > 0 &&
    selectedIds.every((id) => getPendingAction(id) === "Pending");
  const hasDelegateStatus = isDelegateAction || 
    selectedIds.some((id) => getPendingAction(id) === 'Delegate');

  // Button fill logic:
  // - If pending Approve/Reject, show filled
  // - If no pending action but row data shows approved/rejected, show filled
  // - If explicitly set to Pending (undone), buttons should be hollow (override row data state)
  // Check if ANY selected item is explicitly set to Pending (undone) - if so, button should be unfilled
  const approveFilled = isPendingReset ? false : (isApprovePending || (!hasAnyPending && (isApproved || isApproveAction)));
  const rejectFilled = isPendingReset ? false : (isRejectPending || (!hasAnyPending && (isRejected || isRejectAction)));
  
  // Disable buttons if any selected row has a pending action (Approve, Reject, Remediate, or Delegate)
  // This prevents changing actions once they've been set
  const hasAnyPendingAction = selectedIds.some((id) => {
    const pendingAction = getPendingAction(id);
    return pendingAction === 'Approve' || pendingAction === 'Reject' || 
           pendingAction === 'Remediate' || pendingAction === 'Delegate';
  });
  const buttonsDisabled = hasAnyPendingAction || isActionLoading;

  // API call to update actions
  const updateActions = async (actionType: string, justification: string) => {
    const payload: any = {
      useraction: [],
      accountAction: [],
      entitlementAction: [],
    };

    if (context === "user") {
      payload.useraction = definedRows.map((row: any) => ({
        userId: row.id,
        actionType,
        justification,
      }));
    } else if (context === "account") {
      payload.accountAction = definedRows.map((row: any) => ({
        actionType,
        lineItemId: row.lineItemId,
        justification,
      }));
    } else if (context === "entitlement") {
      // Remove duplicates and invalid IDs to prevent double-counting
      const uniqueLineItemIds = Array.from(new Set(
        definedRows
          .map(
            (row: any) => row.lineItemId || (row as any)?.accountLineItemId
          )
          .filter((id: any) => Boolean(id) && id !== 'undefined' && id !== 'null')
      ));
      
      payload.entitlementAction = [
        {
          actionType,
          lineItemIds: uniqueLineItemIds,
          justification,
        },
      ];
    }

    try {
      // Avoid calling API with empty entitlement IDs
      const hasEntitlementIds =
        Array.isArray(payload?.entitlementAction?.[0]?.lineItemIds) &&
        payload.entitlementAction![0].lineItemIds.length > 0;

      if (context === "entitlement" && !hasEntitlementIds) {
        console.warn("No entitlement lineItemIds to send. Payload:", payload);
        setError("No entitlement selected or missing IDs.");
        return;
      }

      // Prevent double submit but no global loading overlay
      setIsActionLoading(true);

      // Check if we're setting to Pending
      const isTogglingToPending = actionType === 'Pending';
      
      console.log('[ActionButtons] updateActions called', {
        actionType,
        isTogglingToPending,
        isCertifyFilterActive,
        isRejectFilterActive,
        selectedIds,
        definedRowsCount: definedRows.length
      });
      
      // In certify or reject filter, Pending actions should always be queued and counted
      // (they represent undoing approved/rejected actions)
      // Outside these filters, only queue Pending if there are existing actions to undo
      if (isTogglingToPending && !isCertifyFilterActive && !isRejectFilterActive) {
        const hasExistingQueuedActions = selectedIds.some((id) => {
          const pendingAction = pendingById[id];
          return pendingAction === 'Approve' || pendingAction === 'Reject' || 
                 pendingAction === 'Remediate' || pendingAction === 'Delegate';
        });

        console.log('[ActionButtons] Checking for submitted actions', {
          hasExistingQueuedActions,
          selectedIds,
          pendingById: Object.fromEntries(Object.entries(pendingById).filter(([k]) => selectedIds.includes(k)))
        });

        // Also check if any selected row has an approved/rejected status (already submitted to server)
        // This means we need to queue the undo action to revert it
        const hasSubmittedActions = definedRows.some((row: any) => {
          const rowStatus = (row.status || "").toString().trim().toLowerCase();
          const rowAction = (row.action || "").toString().trim().toLowerCase();
          const rowRecommendation = (row.recommendation || "").toString().trim().toLowerCase();
          
          // Check status field (backend may return Reject or Revoke)
          const hasApprovedStatus = rowStatus === "approved" || rowStatus === "certified";
          const hasRejectedStatus = rowStatus === "rejected" || rowStatus === "revoked" || rowStatus === "reject";
          
          // Check action field (we send Revoke; backend may return reject or revoke)
          const hasApproveAction = rowAction === "approve";
          const hasRejectAction = rowAction === "reject" || rowAction === "revoke";
          
          // Check recommendation field (sometimes action is stored here)
          const hasApproveRecommendation = rowRecommendation === "approve";
          const hasRejectRecommendation = rowRecommendation === "reject" || rowRecommendation === "revoke";
          
          const result = hasApprovedStatus || hasRejectedStatus || 
                        hasApproveAction || hasRejectAction ||
                        hasApproveRecommendation || hasRejectRecommendation;
          
          if (result) {
            console.log('[ActionButtons] Found submitted action to undo:', {
              rowStatus,
              rowAction,
              rowRecommendation,
              lineItemId: row.lineItemId || row.id,
              hasApprovedStatus,
              hasRejectedStatus,
              hasApproveAction,
              hasRejectAction,
              hasApproveRecommendation,
              hasRejectRecommendation
            });
          }
          
          return result;
        });

        // Compute current button fill state to check if there's something to undo
        // This is a more reliable check than trying to detect all possible data structures
        const currentApproveFilled = isPendingReset ? false : (isApprovePending || (!hasAnyPending && (isApproved || isApproveAction)));
        const currentRejectFilled = isPendingReset ? false : (isRejectPending || (!hasAnyPending && (isRejected || isRejectAction)));
        const buttonWasFilled = currentApproveFilled || currentRejectFilled;
        
        console.log('[ActionButtons] Undo decision', {
          hasExistingQueuedActions,
          hasSubmittedActions,
          buttonWasFilled,
          currentApproveFilled,
          currentRejectFilled,
          isApproved,
          isRejected,
          isApproveAction,
          isRejectAction,
          isApprovePending,
          isRejectPending,
          willQueue: hasExistingQueuedActions || hasSubmittedActions || buttonWasFilled
        });
        
        if (
          !hasExistingQueuedActions &&
          !hasSubmittedActions &&
          !buttonWasFilled &&
          !hasRemediatedRows
        ) {
          // No existing queued actions to undo AND no submitted actions to revert AND button wasn't filled,
          // just update local state and don't queue
          console.log('[ActionButtons] No actions to undo, skipping queue');
          setPendingById((prev) => {
            const next = { ...prev } as Record<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'>;
            selectedIds.forEach((id) => {
              next[id] = 'Pending';
              pendingActionsStorage.set(id, 'Pending');
            });
            return next;
          });
          setLastAction(actionType);
          setError(null);
          setTimeout(() => {
            setIsActionLoading(false);
          }, 100);
          return;
        }
        
        console.log('[ActionButtons] Queuing undo action', {
          reason: hasExistingQueuedActions ? 'hasExistingQueuedActions' : 
                  hasSubmittedActions ? 'hasSubmittedActions' : 
                  'buttonWasFilled'
        });
        
        // When undoing (setting to Pending), we need to count it so the submit button appears
        // The ActionPanelContext only counts Pending actions if isCertifyFilter or isRejectFilter is true
        // So we set the appropriate flag based on what was being undone
        const isUndoingApprove = currentApproveFilled || (hasSubmittedActions && 
          definedRows.some((row: any) => {
            const status = (row.status || "").toString().trim().toLowerCase();
            const action = (row.action || "").toString().trim().toLowerCase();
            const recommendation = (row.recommendation || "").toString().trim().toLowerCase();
            return status === "approved" || status === "certified" || 
                   action === "approve" || recommendation === "approve";
          }));
        const isUndoingReject = currentRejectFilled || (hasSubmittedActions && 
          definedRows.some((row: any) => {
            const status = (row.status || "").toString().trim().toLowerCase();
            const action = (row.action || "").toString().trim().toLowerCase();
            const recommendation = (row.recommendation || "").toString().trim().toLowerCase();
            return status === "rejected" || status === "revoked" || status === "reject" ||
                   action === "reject" || action === "revoke" || recommendation === "reject" || recommendation === "revoke";
          }));
        
        // If buttonWasFilled is true, we're definitely undoing something, so ensure it's counted
        // Set the filter flag to ensure the action count increases and submit button appears
        const shouldCountUndo =
          buttonWasFilled ||
          hasExistingQueuedActions ||
          hasSubmittedActions ||
          hasRemediatedRows;
        
        // Queue the action with filter flags set to ensure it's counted
        // This makes the submit button appear when undoing actions
        console.log('[ActionButtons] Calling queueAction for undo', {
          actionType,
          payload,
          isUndoingApprove,
          isUndoingReject,
          buttonWasFilled,
          shouldCountUndo,
          willCountAsCertify: (shouldCountUndo && isUndoingApprove) || isCertifyFilterActive,
          willCountAsReject: (shouldCountUndo && isUndoingReject) || isRejectFilterActive,
          selectedIds
        });
        queueAction({ 
          reviewerId, 
          certId, 
          payload, 
          count: 0,
          // Set filter flags to ensure undo actions are counted
          // If undoing approve, set isCertifyFilter; if undoing reject, set isRejectFilter
          // If we can't determine or both, default to isCertifyFilter to ensure it's counted
          isCertifyFilter: (shouldCountUndo && (isUndoingApprove || !isUndoingReject)) || isCertifyFilterActive,
          isRejectFilter: (shouldCountUndo && isUndoingReject) || isRejectFilterActive
        });
        console.log('[ActionButtons] queueAction called successfully for undo');
        
        // Mark local pending state for button visuals (both state and module-level storage)
        setPendingById((prev) => {
          const next = { ...prev } as Record<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'>;
          selectedIds.forEach((id) => {
            next[id] = 'Pending';
            pendingActionsStorage.set(id, 'Pending');
          });
          return next;
        });
        
        setLastAction(actionType);
        setError(null);
        
        // End local loading state quickly (no overlay)
        setTimeout(() => {
          setIsActionLoading(false);
        }, 100);
        
        // Counter is managed by queueAction. Do not refresh here; Submit handles it.
        return;
      }

      // Queue the action - ActionPanelContext will:
      // 1. Remove any existing actions for the same items (overlap detection)
      // 2. Add the new action
      // 3. Recalculate count (including Pending if in certify or reject filter)
      console.log('[ActionButtons] Calling queueAction', {
        actionType,
        payload,
        isCertifyFilter: isCertifyFilterActive,
        isRejectFilter: isRejectFilterActive,
        selectedIds
      });
      queueAction({ 
        reviewerId, 
        certId, 
        payload, 
        count: 0,
        isCertifyFilter: isCertifyFilterActive,
        isRejectFilter: isRejectFilterActive
      });
      console.log('[ActionButtons] queueAction called successfully');

       // Mark local pending state for button visuals (both state and module-level storage)
       // Store 'Reject' for Revoke so button fill logic (isRejectPending) works
       const pendingValue = actionType === 'Revoke' ? 'Reject' : actionType;
       setPendingById((prev) => {
         const next = { ...prev } as Record<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'>;
         if (actionType === 'Pending') {
           // When undoing (setting to Pending), mark as 'Pending' to ensure buttons become unfilled
           selectedIds.forEach((id) => {
             next[id] = 'Pending';
             pendingActionsStorage.set(id, 'Pending');
           });
         } else {
           selectedIds.forEach((id) => {
             next[id] = pendingValue as any;
             pendingActionsStorage.set(id, pendingValue as any);
           });
         }
         return next;
       });
      
      setLastAction(actionType);
      setError(null);
      
      // Notify parent of action success with action type
      if (onActionSuccess && (actionType === 'Approve' || actionType === 'Revoke' || actionType === 'Reject')) {
        onActionSuccess();
      }
      
      // End local loading state quickly (no overlay)
      setTimeout(() => {
        setIsActionLoading(false);
      }, 100);
      
      // Counter is managed by queueAction. Do not refresh here; Submit handles it.
    } catch (err: any) {
      setError(`Failed to update actions: ${err.message}`);
      console.error("API error:", err);
      setIsActionLoading(false);
      throw err;
    }
  };
  useEffect(() => {
    setLastAction(null);
    // Sync state from module-level storage when selectedRows change
    const currentDefinedRows = (selectedRows || []).filter((r): r is T => !!r);
    const selectedIds = currentDefinedRows
      .map((row: any) => row.lineItemId || row.id)
      .filter(Boolean) as string[];
    if (selectedIds.length > 0) {
      setPendingById((prev) => {
        const next = { ...prev };
        // Update from module-level storage for selected IDs
        selectedIds.forEach((id) => {
          const storedAction = pendingActionsStorage.get(id);
          if (storedAction) {
            next[id] = storedAction;
          }
        });
        return next;
      });
    }
  }, [selectedRows]);

  // Listen for reset events to clear local button states
  useEffect(() => {
    const handleStorageClear = () => {
      // Clear local pendingById state when storage is cleared
      setPendingById({});
    };

    // Listen for custom event when reset is called
    window.addEventListener('actionPanelReset', handleStorageClear);
    
    return () => {
      window.removeEventListener('actionPanelReset', handleStorageClear);
    };
  }, []);


  // Helper: local draft first, then comment on the record from API, then default (used for undo, approve, revoke, etc.)
  const getJustification = (defaultJustification: string): string => {
    if (selectedIds.length === 0) return defaultJustification;

    for (const id of selectedIds) {
      const savedComment = commentsStorage.get(id);
      if (savedComment && savedComment.trim()) {
        return savedComment.trim();
      }
    }

    for (const row of definedRows) {
      const fromRecord = extractCommentFromRow(row as any);
      if (fromRecord) return fromRecord;
    }

    return defaultJustification;
  };

  const remediationDetailJustification =
    extractRemediationJustificationFromRows(definedRows as any[]) || "—";
  const remediationDetailEndDate =
    extractRemediationEndDateFromRow(definedRows[0] as any) || "—";
  const remediationDetailAction =
    extractRemediateActionFromRows(definedRows as any[]) || "—";

  const handleRemediateDetailUndo = async () => {
    if (definedRows.length === 0 || isActionLoading) return;
    setIsRemediateDetailModalOpen(false);
    await updateActions("Pending", getJustification("Undo remediation"));
    if (onActionSuccess) {
      onActionSuccess();
    }
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!api || definedRows.length === 0 || isActionLoading) return;
    
    console.log('[ActionButtons] handleApprove called', {
      isAllPendingReset,
      isPendingReset,
      isApprovePending,
      isRejectPending,
      isApproved,
      isApproveAction,
      selectedIds,
      rowData: definedRows.map((r: any) => ({
        lineItemId: r.lineItemId || r.id,
        status: r.status,
        action: r.action,
        recommendation: r.recommendation
      }))
    });
    
    // If currently set to Pending (undone) and button is clicked, restore to Approve
    if (isAllPendingReset || (isPendingReset && !isApprovePending && !isRejectPending)) {
      console.log('[ActionButtons] Restoring to Approve from Pending state');
      await updateActions("Approve", getJustification("Approved via UI"));
    }
    // If already marked approve (pending state) OR underlying state approved, toggle to Pending
    else if (isApprovePending || isApproved || isApproveAction) {
      console.log('[ActionButtons] Toggling to Pending (undo)', {
        isApprovePending,
        isApproved,
        isApproveAction
      });
      await updateActions("Pending", getJustification("Reset to pending"));
    } else {
      console.log('[ActionButtons] Setting to Approve');
      await updateActions("Approve", getJustification("Approved via UI"));
    }
  };

  const handleRevoke = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!api || definedRows.length === 0 || isActionLoading) return;
    
    console.log('[ActionButtons] handleRevoke called', {
      isAllPendingReset,
      isPendingReset,
      isApprovePending,
      isRejectPending,
      isRejected,
      isRejectAction,
      selectedIds,
      rowData: definedRows.map((r: any) => ({
        lineItemId: r.lineItemId || r.id,
        status: r.status,
        action: r.action,
        recommendation: r.recommendation
      }))
    });
    
    // If currently set to Pending (undone) and button is clicked, restore to Revoke
    if (isAllPendingReset || (isPendingReset && !isApprovePending && !isRejectPending)) {
      console.log('[ActionButtons] Restoring to Reject from Pending state');
      await updateActions("Revoke", getJustification("Revoked via UI"));
    }
    // If already marked reject (pending state) OR underlying state rejected, toggle to Pending
    else if (isRejectPending || isRejected || isRejectAction) {
      console.log('[ActionButtons] Toggling to Pending (undo)', {
        isRejectPending,
        isRejected,
        isRejectAction
      });
      await updateActions("Pending", getJustification("Reset to pending"));
    } else {
      console.log('[ActionButtons] Setting to Reject');
      await updateActions("Revoke", getJustification("Revoked via UI"));
    }
  };

  const handleUndo = async (
    e: React.MouseEvent,
    originalAction: "Approve" | "Revoke"
  ) => {
    e.stopPropagation();
    if (!api || definedRows.length === 0 || isActionLoading) return;
    await updateActions("Pending", getJustification(`Undo ${originalAction}`));
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (definedRows.length === 0) return;
    
    // Load existing comment for the selected rows (use first row's comment if multiple selected)
    const firstRowId = selectedIds[0];
    const firstRow = definedRows[0] as any;
    
    // Check if row has been certified or rejected
    const isCertified = isApproved || isApproveAction;
    const isRejectedRow = isRejected || isRejectAction;
    
    const hasNewComment = firstRow ? extractCommentFromRow(firstRow) : null;
    if (hasNewComment) {
      console.log(
        "[ActionButtons] Comment from row:",
        "value:",
        hasNewComment
      );
    }
    
    // Debug logging
    console.log('[ActionButtons] handleComment', {
      firstRowId,
      isCertified,
      isRejectedRow,
      hasNewComment,
      rowData: firstRow ? Object.keys(firstRow) : [],
      status: firstRow?.status,
      action: firstRow?.action,
      storedComment: firstRowId ? commentsStorage.get(firstRowId) : null
    });
    
    // Priority: local draft (this session) > row (new comment before previous/old via extractCommentFromRow)
    let commentToShow = "";
    const storedComment = firstRowId ? commentsStorage.get(firstRowId) || "" : "";

    if (storedComment) {
      commentToShow = storedComment;
    } else if (hasNewComment) {
      commentToShow = hasNewComment;
    }
    
    console.log('[ActionButtons] Final comment to show:', commentToShow, {
      isCertified,
      isRejectedRow,
      hasNewComment,
      storedComment
    });
    
    setCommentText(commentToShow);
    setCommentCategory(""); // Reset category selection
    setCommentSubcategory(""); // Reset subcategory selection
    setIsCommentDropdownOpen(false); // Reset dropdown state
    setIsCommentModalOpen(true);
  };

  const handleSaveComment = async () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment) return;

    // Save comment for all selected rows (used later as default justification)
    selectedIds.forEach((id) => {
      commentsStorage.set(id, trimmedComment);
    });

    setIsCommentModalOpen(false);
    setCommentText("");
  };

  const handleCancelComment = () => {
    setIsCommentModalOpen(false);
    setCommentText("");
    setCommentCategory("");
    setCommentSubcategory("");
    setIsCommentDropdownOpen(false);
  };

  // Comment options data structure
  const commentOptions = {
    "Approve": [
      "Access required to perform current job responsibilities.",
      "Access aligns with user's role and department functions.",
      "Validated with manager/business owner – appropriate access.",
      "No SoD (Segregation of Duties) conflict identified.",
      "User continues to work on project/system requiring this access."
    ],
    "Revoke": [
      "User no longer in role requiring this access.",
      "Access redundant – duplicate with other approved entitlements.",
      "Access not used in last 90 days (inactive entitlement).",
      "SoD conflict identified – removing conflicting access.",
      "Temporary/project-based access – no longer required."
    ]
  };

  const handleCategoryChange = (category: string) => {
    setCommentCategory(category);
    setCommentSubcategory(""); // Reset subcategory when category changes
    setCommentText(""); // Clear text when category changes
  };

  const handleSubcategoryChange = (subcategory: string) => {
    setCommentSubcategory(subcategory);
    setCommentText(`${commentCategory} - ${subcategory}`);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);

    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom,
        left: rect.left - 128,
      });
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target as Node) &&
      menuButtonRef.current &&
      !menuButtonRef.current.contains(event.target as Node)
    ) {
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const openModal = () => {
    setIsModalOpen(true);
    setIsMenuOpen(false);
  };

  const openDelegateModal = () => {
    setIsDelegateModalOpen(true);
    setIsMenuOpen(false);
  };

  // Helper to queue a Remediate action into the central ActionPanel
  const queueRemediateAction = async (
    remediateType: string,
    justification: string
  ) => {
    if (!reviewerId || !certId || selectedIds.length === 0) {
      return;
    }

    // Build unique entitlement lineItemIds from the selected rows
    const uniqueLineItemIds = Array.from(
      new Set(
        definedRows
          .map(
            (row: any) => row.lineItemId || (row as any)?.accountLineItemId
          )
          .filter(
            (id: any) =>
              Boolean(id) && id !== "undefined" && id !== "null"
          )
      )
    ) as string[];

    if (uniqueLineItemIds.length === 0) {
      return;
    }

    const payload: any = {
      useraction: [],
      accountAction: [],
      entitlementAction: [
        {
          actionType: "Remediate",
          lineItemIds: uniqueLineItemIds,
          justification,
          remediateAction: remediateType,
        },
      ],
    };

    // Queue remediate action so it is submitted via the floating Submit button
    queueAction({
      reviewerId,
      certId,
      payload,
      count: 0,
    });

    // Mark local pending state for button visuals (both state and module-level storage)
    setPendingById((prev) => {
      const next = {
        ...prev,
      } as Record<
        string,
        "Approve" | "Reject" | "Pending" | "Remediate" | "Delegate"
      >;
      selectedIds.forEach((id) => {
        next[id] = "Remediate";
        pendingActionsStorage.set(id, "Remediate");
      });
      return next;
    });

    setHasRemediateAction(true);
  };

  // Separate handlers for each remediate action – they all queue into ActionPanel
  const handleLockAccount = async (justification: string) => {
    console.log("Lock Account (queued remediate):", justification, selectedRows);
    await queueRemediateAction("LOCK_ACCOUNT", justification);
    if (onActionSuccess) {
      onActionSuccess();
    }
  };

  const handleRevokeAccess = async (justification: string) => {
    console.log("Revoke Access (queued remediate):", justification, selectedRows);
    await queueRemediateAction("IMMEDIATE_REVOKE", justification);
    if (onActionSuccess) {
      onActionSuccess();
    }
  };

  const handleConditionalAccess = async (endDate: string, justification: string) => {
    console.log(
      "Conditional Access (queued remediate):",
      endDate,
      justification,
      selectedRows
    );
    await queueRemediateAction("CONDITIONAL_ACCESS", justification);
    if (onActionSuccess) {
      onActionSuccess();
    }
  };

  const handleModifyAccess = async (newAccess: string, justification: string) => {
    console.log(
      "Modify Access (queued remediate):",
      newAccess,
      justification,
      selectedRows
    );
    await queueRemediateAction("MODIFY_ACCESS", justification);
    if (onActionSuccess) {
      onActionSuccess();
    }
  };

  const openRemediateSidebar = () => {
    const firstRow = definedRows[0] as any;
    const reviewerNameFromRow =
      firstRow?.userName ?? firstRow?.reviewerName ?? firstRow?.fullName ?? "";
    const remediateContent = (
      <RemediateSidebar
        selectedRows={selectedRows}
        onClose={closeSidebar}
        onLockAccount={handleLockAccount}
        onRevokeAccess={handleRevokeAccess}
        onConditionalAccess={handleConditionalAccess}
        onModifyAccess={handleModifyAccess}
        isActionLoading={isActionLoading}
        reviewerId={reviewerId}
        certId={certId}
        reviewerName={reviewerNameFromRow}
      />
    );
    openSidebar(remediateContent, { widthPx: 500, title: "Remediate action" });
    setIsMenuOpen(false);
  };

  // If delegate action exists, show "D" badge with Comment and Teams buttons
  if (hasDelegateStatus) {
    return (
      <div className="flex space-x-3 h-full items-center">
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold">
          D
        </span>
        <button
          onClick={handleComment}
          title="Comment"
          aria-label="Add comment"
          className="p-1 rounded"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 32 32"
            className="cursor-pointer hover:opacity-80"
          >
            <path
              d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
              fill="#2684FF"
            />
          </svg>
        </button>
        {!hideTeamsIcon && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const email = userEmail || "Harish.jangada@icallidus.com";
              
              // Extract application and entitlement names from selected rows
              const firstRow = definedRows.length > 0 ? (definedRows[0] as any) : null;
              const applicationName = firstRow?.applicationName || "Unknown Application";
              const entitlementName = firstRow?.entitlementName || "Unknown Entitlement";
              
              // Create the message with application and entitlement details
              const message = `Can you please clarify the following access - Application: ${applicationName}, Entitlement: ${entitlementName}`;
              const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${email}&message=${encodeURIComponent(message)}`;
              console.log("Opening Teams URL:", teamsUrl);
              window.open(teamsUrl, '_blank', 'noopener,noreferrer');
            }}
            title="Open in Microsoft Teams"
            aria-label="Open in Microsoft Teams"
            className="p-1 rounded transition-colors duration-200 hover:bg-gray-100 flex-shrink-0 cursor-pointer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg
              width="28px"
              height="28px"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
            >
              <path
                fill="#5059C9"
                d="M10.765 6.875h3.616c.342 0 .619.276.619.617v3.288a2.272 2.272 0 01-2.274 2.27h-.01a2.272 2.272 0 01-2.274-2.27V7.199c0-.179.145-.323.323-.323zM13.21 6.225c.808 0 1.464-.655 1.464-1.462 0-.808-.656-1.463-1.465-1.463s-1.465.655-1.465 1.463c0 .807.656 1.462 1.465 1.462z"
              />
              <path
                fill="#7B83EB"
                d="M8.651 6.225a2.114 2.114 0 002.117-2.112A2.114 2.114 0 008.65 2a2.114 2.114 0 00-2.116 2.112c0 1.167.947 2.113 2.116 2.113zM11.473 6.875h-5.97a.611.611 0 00-.596.625v3.75A3.669 3.669 0 008.488 15a3.669 3.669 0 003.582-3.75V7.5a.611.611 0 00-.597-.625z"
              />
              <path
                fill="url(#microsoft-teams-color-16__paint0_linear_2372_494)"
                d="M1.597 4.925h5.969c.33 0 .597.267.597.596v5.958a.596.596 0 01-.597.596h-5.97A.596.596 0 011 11.479V5.521c0-.33.267-.596.597-.596z"
              />
              <path
                fill="#ffffff"
                d="M6.152 7.193H4.959v3.243h-.76V7.193H3.01v-.63h3.141v.63z"
              />
              <defs>
                <linearGradient
                  id="microsoft-teams-color-16__paint0_linear_2372_494"
                  x1="2.244"
                  x2="6.906"
                  y1="4.46"
                  y2="12.548"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#5A62C3" />
                  <stop offset=".5" stopColor="#4D55BD" />
                  <stop offset="1" stopColor="#3940AB" />
                </linearGradient>
              </defs>
            </svg>
          </button>
        )}
      </div>
    );
  }

  // If remediate action exists, show "R" badge with Comment and Teams buttons
  if (hasRemediateStatus && !isRemediateUndoQueued) {
    return (
      <div className="flex space-x-3 h-full items-center">
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button
          type="button"
          title="Remediation details"
          aria-label="Open remediation details"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsRemediateDetailModalOpen(true);
          }}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          R
        </button>
        {isRemediateDetailModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] px-3"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remediate-detail-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsRemediateDetailModalOpen(false);
                }
              }}
            >
              <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 border border-gray-200 overflow-hidden flex flex-col max-h-[min(90vh,560px)]">
                <header className="flex-shrink-0 px-5 py-4 border-b border-gray-200 bg-gray-50">
                  <h3
                    id="remediate-detail-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    Remediation details
                  </h3>
                </header>
                <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End date
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={remediationDetailEndDate}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-gray-50"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remediate action
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={remediationDetailAction}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Justification
                    </label>
                    <textarea
                      readOnly
                      rows={4}
                      value={remediationDetailJustification}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-gray-50 resize-y min-h-[100px]"
                    />
                  </div>
                </div>
                <footer className="flex-shrink-0 px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRemediateDetailModalOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isActionLoading || viewChangeEnable === false}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemediateDetailUndo();
                    }}
                  >
                    Undo
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )}
        <button
          onClick={handleComment}
          title="Comment"
          aria-label="Add comment"
          className="p-1 rounded"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 32 32"
            className="cursor-pointer hover:opacity-80"
          >
            <path
              d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
              fill="#2684FF"
            />
          </svg>
        </button>
        {!hideTeamsIcon && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const email = userEmail || "Harish.jangada@icallidus.com";
              
              // Extract application and entitlement names from selected rows
              const firstRow = definedRows.length > 0 ? (definedRows[0] as any) : null;
              const applicationName = firstRow?.applicationName || "Unknown Application";
              const entitlementName = firstRow?.entitlementName || "Unknown Entitlement";
              
              // Create the message with application and entitlement details
              const message = `Can you please clarify the following access - Application: ${applicationName}, Entitlement: ${entitlementName}`;
              const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${email}&message=${encodeURIComponent(message)}`;
              console.log("Opening Teams URL:", teamsUrl);
              window.open(teamsUrl, '_blank', 'noopener,noreferrer');
            }}
            title="Open in Microsoft Teams"
            aria-label="Open in Microsoft Teams"
            className="p-1 rounded transition-colors duration-200 hover:bg-gray-100 flex-shrink-0 cursor-pointer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg
              width="28px"
              height="28px"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
            >
              <path
                fill="#5059C9"
                d="M10.765 6.875h3.616c.342 0 .619.276.619.617v3.288a2.272 2.272 0 01-2.274 2.27h-.01a2.272 2.272 0 01-2.274-2.27V7.199c0-.179.145-.323.323-.323zM13.21 6.225c.808 0 1.464-.655 1.464-1.462 0-.808-.656-1.463-1.465-1.463s-1.465.655-1.465 1.463c0 .807.656 1.462 1.465 1.462z"
              />
              <path
                fill="#7B83EB"
                d="M8.651 6.225a2.114 2.114 0 002.117-2.112A2.114 2.114 0 008.65 2a2.114 2.114 0 00-2.116 2.112c0 1.167.947 2.113 2.116 2.113zM11.473 6.875h-5.97a.611.611 0 00-.596.625v3.75A3.669 3.669 0 008.488 15a3.669 3.669 0 003.582-3.75V7.5a.611.611 0 00-.597-.625z"
              />
              <path
                fill="url(#microsoft-teams-color-16__paint0_linear_2372_494)"
                d="M1.597 4.925h5.969c.33 0 .597.267.597.596v5.958a.596.596 0 01-.597.596h-5.97A.596.596 0 011 11.479V5.521c0-.33.267-.596.597-.596z"
              />
              <path
                fill="#ffffff"
                d="M6.152 7.193H4.959v3.243h-.76V7.193H3.01v-.63h3.141v.63z"
              />
              <defs>
                <linearGradient
                  id="microsoft-teams-color-16__paint0_linear_2372_494"
                  x1="2.244"
                  x2="6.906"
                  y1="4.46"
                  y2="12.548"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#5A62C3" />
                  <stop offset=".5" stopColor="#4D55BD" />
                  <stop offset="1" stopColor="#3940AB" />
                </linearGradient>
              </defs>
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex space-x-3 h-full items-center">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      {!isRejectFilterActive && (
        <button
          onClick={handleApprove}
          title={approveFilled ? "Undo" : "Approve"}
          aria-label="Approve selected rows"
          disabled={buttonsDisabled}
          className={`p-1 rounded flex items-center justify-center ${buttonsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="relative inline-flex items-center justify-center w-8 h-8">
            <CircleCheck
              className={buttonsDisabled ? "cursor-not-allowed" : "cursor-pointer"}
              color="#1c821cff"
              strokeWidth="1"
              size="32"
              fill={approveFilled ? "#1c821cff" : "none"}
            />
            {approveFilled && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                className="absolute pointer-events-none"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <path
                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                  fill="#ffffff"
                />
              </svg>
            )}
          </div>
        </button>
      )}

      {!isCertifyFilterActive && (
        <button
          onClick={handleRevoke}
          title={rejectFilled ? "Undo" : "Revoke"}
          aria-label="Revoke selected rows"
          disabled={buttonsDisabled}
          className={`p-1 rounded flex items-center justify-center ${buttonsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="relative inline-flex items-center justify-center w-8 h-8">
            <CircleX
              className={buttonsDisabled ? "cursor-not-allowed" : "cursor-pointer"}
              color="#FF2D55"
              strokeWidth="1"
              size="32"
              fill={rejectFilled ? "#FF2D55" : "none"}
            />
            {rejectFilled && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                className="absolute pointer-events-none"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="#ffffff"
                />
              </svg>
            )}
          </div>
        </button>
      )}

      <button
        onClick={handleComment}
        title="Comment"
        aria-label="Add comment"
        className="p-1 rounded"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 32 32"
          className="cursor-pointer hover:opacity-80"
        >
          <path
            d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
            fill="#2684FF"
          />
        </svg>
      </button>

      {!hideTeamsIcon && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const email = userEmail || "Harish.jangada@icallidus.com";
            
            // Extract application and entitlement names from selected rows
            const firstRow = definedRows.length > 0 ? (definedRows[0] as any) : null;
            const applicationName = firstRow?.applicationName || "Unknown Application";
            const entitlementName = firstRow?.entitlementName || "Unknown Entitlement";
            
            // Create the message with application and entitlement details
            const message = `Can you please clarify the following access - Application: ${applicationName}, Entitlement: ${entitlementName}`;
            const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${email}&message=${encodeURIComponent(message)}`;
            console.log("Opening Teams URL:", teamsUrl);
            window.open(teamsUrl, '_blank', 'noopener,noreferrer');
          }}
          title="Open in Microsoft Teams"
          aria-label="Open in Microsoft Teams"
          className="p-1 rounded transition-colors duration-200 hover:bg-gray-100 flex-shrink-0 cursor-pointer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg
            width="28px"
            height="28px"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
          >
            <path
              fill="#5059C9"
              d="M10.765 6.875h3.616c.342 0 .619.276.619.617v3.288a2.272 2.272 0 01-2.274 2.27h-.01a2.272 2.272 0 01-2.274-2.27V7.199c0-.179.145-.323.323-.323zM13.21 6.225c.808 0 1.464-.655 1.464-1.462 0-.808-.656-1.463-1.465-1.463s-1.465.655-1.465 1.463c0 .807.656 1.462 1.465 1.462z"
            />
            <path
              fill="#7B83EB"
              d="M8.651 6.225a2.114 2.114 0 002.117-2.112A2.114 2.114 0 008.65 2a2.114 2.114 0 00-2.116 2.112c0 1.167.947 2.113 2.116 2.113zM11.473 6.875h-5.97a.611.611 0 00-.596.625v3.75A3.669 3.669 0 008.488 15a3.669 3.669 0 003.582-3.75V7.5a.611.611 0 00-.597-.625z"
            />
            <path
              fill="url(#microsoft-teams-color-16__paint0_linear_2372_494)"
              d="M1.597 4.925h5.969c.33 0 .597.267.597.596v5.958a.596.596 0 01-.597.596h-5.97A.596.596 0 011 11.479V5.521c0-.33.267-.596.597-.596z"
            />
            <path
              fill="#ffffff"
              d="M6.152 7.193H4.959v3.243h-.76V7.193H3.01v-.63h3.141v.63z"
            />
            <defs>
              <linearGradient
                id="microsoft-teams-color-16__paint0_linear_2372_494"
                x1="2.244"
                x2="6.906"
                y1="4.46"
                y2="12.548"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#5A62C3" />
                <stop offset=".5" stopColor="#4D55BD" />
                <stop offset="1" stopColor="#3940AB" />
              </linearGradient>
            </defs>
          </svg>
        </button>
      )}

      {}

      <button
        ref={menuButtonRef}
        onClick={toggleMenu}
        title="More Actions"
        className={`cursor-pointer rounded-sm hover:opacity-80 ${
          isMenuOpen ? "bg-[#6D6E73]/20" : ""
        }`}
        aria-label="More actions"
      >
        <MoreVertical
          color="#35353A"
          size="32"
          className="transform scale-[0.6]"
        />
      </button>
      <div className="relative flex items-center">
        {isMenuOpen &&
          createPortal(
            <div
              ref={menuRef}
              className="absolute bg-white border border-gray-300 shadow-lg rounded-md z-50"
              style={{
                position: "fixed",
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                minWidth: "160px",
                padding: "8px",
              }}
            >
              <ul className="py-2 text-sm text-gray-700">
                {}
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={openDelegateModal}
                >
                  Delegate
                </li>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={openRemediateSidebar}
                >
                  Remediate
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>

      <ProxyActionModal
        isModalOpen={isModalOpen}
        closeModal={() => setIsModalOpen(false)}
        heading="Proxy Action"
        users={[
          { username: "john", email: "john@example.com", role: "admin" },
          { username: "jane", email: "jane@example.com", role: "user" },
        ]}
        groups={[
          { name: "admins", email: "admins@corp.com", role: "admin" },
          { name: "devs", email: "devs@corp.com", role: "developer" },
        ]}
        userAttributes={[
          { value: "username", label: "Username" },
          { value: "email", label: "Email" },
        ]}
        groupAttributes={[
          { value: "name", label: "Group Name" },
          { value: "role", label: "Role" },
        ]}
        onSelectOwner={(owner) => {
          setIsModalOpen(false);
        }}
      />

      <DelegateActionModal
        isModalOpen={isDelegateModalOpen}
        closeModal={() => setIsDelegateModalOpen(false)}
        heading="Delegate Action"
        users={[
          { username: "john", email: "john@example.com", role: "admin" },
          { username: "jane", email: "jane@example.com", role: "user" },
        ]}
        groups={[
          { name: "admins", email: "admins@corp.com", role: "admin" },
          { name: "devs", email: "devs@corp.com", role: "developer" },
        ]}
        userAttributes={[
          { value: "username", label: "Username" },
          { value: "email", label: "Email" },
        ]}
        groupAttributes={[
          { value: "name", label: "Group Name" },
          { value: "role", label: "Role" },
        ]}
        onSelectDelegate={async (delegate) => {
          setSelectedDelegate(delegate);
          setIsDelegateModalOpen(false);
          // Mark delegate action for selected rows
          const delegateIds = definedRows
            .map((row: any) => row.lineItemId || row.id)
            .filter(Boolean) as string[];
          setPendingById((prev) => {
            const next = { ...prev } as Record<string, 'Approve' | 'Reject' | 'Pending' | 'Remediate' | 'Delegate'>;
            delegateIds.forEach((id) => {
              next[id] = 'Delegate';
              pendingActionsStorage.set(id, 'Delegate');
            });
            return next;
          });
          // Use saved comment as justification for delegate action
          const justification = getJustification("Delegated via UI");
          await updateActions("Delegate", justification);
          if (onActionSuccess) {
            onActionSuccess();
          }
        }}
      />

      {/* Comment Modal */}
      {isCommentModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-3">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full mx-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Comment</h3>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment Suggestions
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center justify-between"
                    onClick={() => setIsCommentDropdownOpen(!isCommentDropdownOpen)}
                  >
                    <span className="text-gray-500">
                      {commentSubcategory ? `${commentCategory} - ${commentSubcategory}` : 'Select a comment suggestion...'}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isCommentDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isCommentDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                      <div className="p-2 space-y-2">
                        {/* Approve Section */}
                        <div>
                          <div className="flex items-center p-1">
                            <div className="w-3 h-3 rounded-full border-2 mr-2 flex items-center justify-center border-green-500 bg-green-500">
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                            <span className="text-xs font-medium text-gray-900">Approve</span>
                          </div>
                          
                          <div className="ml-5 mt-1 space-y-1">
                            {commentOptions["Approve"].map((option, index) => (
                              <div
                                key={index}
                                className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                onClick={() => {
                                  handleCategoryChange("Approve");
                                  handleSubcategoryChange(option);
                                  setIsCommentDropdownOpen(false);
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Revoke Section */}
                        <div>
                          <div className="flex items-center p-1">
                            <div className="w-3 h-3 rounded-full border-2 mr-2 flex items-center justify-center border-red-500 bg-red-500">
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                            <span className="text-xs font-medium text-gray-900">Revoke</span>
                          </div>
                          
                          <div className="ml-5 mt-1 space-y-1">
                            {commentOptions["Revoke"].map((option, index) => (
                              <div
                                key={index}
                                className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                onClick={() => {
                                  handleCategoryChange("Revoke");
                                  handleSubcategoryChange(option);
                                  setIsCommentDropdownOpen(false);
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    commentCategory 
                      ? `Enter additional details for ${commentCategory.toLowerCase()}...` 
                      : "Select an action type and reason, or enter your comment here..."
                  }
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end items-center gap-3">
                <button
                  onClick={handleCancelComment}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors min-w-[72px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveComment}
                  disabled={!commentText.trim()}
                  className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors min-w-[72px] ${
                    commentText.trim()
                      ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};

export default ActionButtons;
